import { describe, it, expect } from 'vitest';
import { parseOef } from '../src/parser/oef-parser.js';

const VALID_OEF = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       identifier="model-001">
  <name>Test Model</name>
  <documentation>Test documentation</documentation>
  <elements>
    <element identifier="el-001" xsi:type="BusinessProcess">
      <name>Order Processing</name>
    </element>
    <element identifier="el-002" xsi:type="ApplicationComponent">
      <name>Order System</name>
    </element>
    <element identifier="el-003" xsi:type="DataObject">
      <name>Order</name>
      <properties>
        <property key="status" value="active"/>
      </properties>
    </element>
  </elements>
  <relationships>
    <relationship identifier="rel-001" xsi:type="Serving" source="el-002" target="el-001">
    </relationship>
    <relationship identifier="rel-002" xsi:type="Access" source="el-001" target="el-003">
    </relationship>
  </relationships>
  <views>
    <diagrams>
      <view identifier="view-001" viewpointType="Application Cooperation">
        <name>Main View</name>
        <node elementRef="el-001"/>
        <node elementRef="el-002"/>
        <connection relationshipRef="rel-001"/>
      </view>
    </diagrams>
  </views>
</model>`;

const EMPTY_OEF = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/"
       identifier="model-empty">
  <name>Empty Model</name>
</model>`;

describe('parseOef', () => {
  describe('valid OEF XML', () => {
    it('returns model with correct id and name', () => {
      const model = parseOef(VALID_OEF);
      expect(model.id).toBe('model-001');
      expect(model.name).toBe('Test Model');
      expect(model.documentation).toBe('Test documentation');
    });

    it('parses elements into a Map', () => {
      const model = parseOef(VALID_OEF);
      expect(model.elements).toBeInstanceOf(Map);
      expect(model.elements.size).toBe(3);
    });

    it('parses element with correct type and layer', () => {
      const model = parseOef(VALID_OEF);
      const proc = model.elements.get('el-001');
      expect(proc).toBeDefined();
      expect(proc!.name).toBe('Order Processing');
      expect(proc!.type).toBe('BusinessProcess');
      expect(proc!.layer).toBe('business');
    });

    it('parses ApplicationComponent with application layer', () => {
      const model = parseOef(VALID_OEF);
      const app = model.elements.get('el-002');
      expect(app!.type).toBe('ApplicationComponent');
      expect(app!.layer).toBe('application');
    });

    it('parses element properties', () => {
      const model = parseOef(VALID_OEF);
      const order = model.elements.get('el-003');
      expect(order!.properties).toHaveLength(1);
      expect(order!.properties[0]).toEqual({ key: 'status', value: 'active' });
    });

    it('parses relations into a Map', () => {
      const model = parseOef(VALID_OEF);
      expect(model.relations).toBeInstanceOf(Map);
      expect(model.relations.size).toBe(2);
    });

    it('parses relation with correct source/target/type', () => {
      const model = parseOef(VALID_OEF);
      const rel = model.relations.get('rel-001');
      expect(rel).toBeDefined();
      expect(rel!.type).toBe('Serving');
      expect(rel!.sourceId).toBe('el-002');
      expect(rel!.targetId).toBe('el-001');
    });

    it('parses views into a Map', () => {
      const model = parseOef(VALID_OEF);
      expect(model.views).toBeInstanceOf(Map);
      expect(model.views.size).toBe(1);
    });

    it('parses view elements and relations correctly', () => {
      const model = parseOef(VALID_OEF);
      const view = model.views.get('view-001');
      expect(view).toBeDefined();
      expect(view!.name).toBe('Main View');
      expect(view!.elements).toHaveLength(2);
      expect(view!.elements[0].elementId).toBe('el-001');
      expect(view!.elements[1].elementId).toBe('el-002');
      expect(view!.relations).toEqual(['rel-001']);
    });

    it('parses viewpoint', () => {
      const model = parseOef(VALID_OEF);
      const view = model.views.get('view-001');
      expect(view!.viewpoint).toBe('Application Cooperation');
    });
  });

  describe('empty model', () => {
    it('parses model with no elements/relations/views', () => {
      const model = parseOef(EMPTY_OEF);
      expect(model.id).toBe('model-empty');
      expect(model.name).toBe('Empty Model');
      expect(model.elements.size).toBe(0);
      expect(model.relations.size).toBe(0);
      expect(model.views.size).toBe(0);
    });

    it('returns empty Maps (not arrays)', () => {
      const model = parseOef(EMPTY_OEF);
      expect(model.elements).toBeInstanceOf(Map);
      expect(model.relations).toBeInstanceOf(Map);
      expect(model.views).toBeInstanceOf(Map);
    });
  });

  describe('invalid XML', () => {
    it('throws on missing model root element', () => {
      expect(() => parseOef('<notamodel/>')).toThrow('missing <model> root element');
    });

    it('throws on completely malformed input', () => {
      expect(() => parseOef('not xml at all <<<')).toThrow();
    });
  });

  describe('relation type normalization', () => {
    it('strips -Relationship suffix', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       identifier="m1">
  <name>M</name>
  <elements>
    <element identifier="a" xsi:type="BusinessProcess"><name>A</name></element>
    <element identifier="b" xsi:type="BusinessProcess"><name>B</name></element>
  </elements>
  <relationships>
    <relationship identifier="r1" xsi:type="Triggering-Relationship" source="a" target="b"/>
  </relationships>
</model>`;
      const model = parseOef(xml);
      expect(model.relations.get('r1')!.type).toBe('Triggering');
    });

    it('falls back to Association for unknown relation types', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       identifier="m1">
  <name>M</name>
  <elements>
    <element identifier="a" xsi:type="BusinessProcess"><name>A</name></element>
    <element identifier="b" xsi:type="BusinessProcess"><name>B</name></element>
  </elements>
  <relationships>
    <relationship identifier="r1" xsi:type="UnknownRelation" source="a" target="b"/>
  </relationships>
</model>`;
      const model = parseOef(xml);
      expect(model.relations.get('r1')!.type).toBe('Association');
    });
  });
});
