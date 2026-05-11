/**
 * @vitest-environment happy-dom
 *
 * Tests voor UML sequence diagram:
 *  1. Parser: 2 lifelines + 2 messages → correcte volgorde
 *  2. detectDiagramType: herkent sequence XMI
 *  3. Viewer.importXml: voltooit zonder error op sequence XMI
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { parseSequenceXmi } from "../src/parser/SequenceParser.js";
import { detectDiagramType } from "../src/Viewer.js";
import { Viewer } from "../src/Viewer.js";

// ─── XMI fixtures ─────────────────────────────────────────────────────────────

const SEQUENCE_XMI = `<?xml version="1.0" encoding="UTF-8"?>
<uml:Model xmi:version="20131001"
  xmlns:xmi="http://www.omg.org/spec/XMI/20131001"
  xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML"
  xmi:id="model-seq"
  name="SeqModel">
  <packagedElement xmi:type="uml:Interaction" xmi:id="interaction-1" name="LoginFlow">
    <lifeline xmi:id="ll-user" name="User" xmi:type="uml:Lifeline"/>
    <lifeline xmi:id="ll-server" name="Server" xmi:type="uml:Lifeline"/>
    <message xmi:id="msg-1" name="login" messageSort="synchCall"
      xmi:type="uml:Message">
      <sendEvent xmi:type="uml:MessageOccurrenceSpecification" covered="ll-user"/>
      <receiveEvent xmi:type="uml:MessageOccurrenceSpecification" covered="ll-server"/>
    </message>
    <message xmi:id="msg-2" name="loginResponse" messageSort="reply"
      xmi:type="uml:Message">
      <sendEvent xmi:type="uml:MessageOccurrenceSpecification" covered="ll-server"/>
      <receiveEvent xmi:type="uml:MessageOccurrenceSpecification" covered="ll-user"/>
    </message>
  </packagedElement>
</uml:Model>`;

// ─── Parser tests ─────────────────────────────────────────────────────────────

describe("SequenceParser", () => {
  it("parset 2 lifelines correct", () => {
    const diagram = parseSequenceXmi(SEQUENCE_XMI);

    expect(diagram.type).toBe("sequence");
    expect(diagram.lifelines).toHaveLength(2);

    const user = diagram.lifelines.find((l) => l.id === "ll-user");
    expect(user).toBeDefined();
    expect(user?.name).toBe("User");

    const server = diagram.lifelines.find((l) => l.id === "ll-server");
    expect(server).toBeDefined();
    expect(server?.name).toBe("Server");
  });

  it("parset 2 messages in de juiste volgorde", () => {
    const diagram = parseSequenceXmi(SEQUENCE_XMI);

    expect(diagram.messages).toHaveLength(2);

    // Berichten moeten oplopend op order gesorteerd kunnen worden
    const sorted = [...diagram.messages].sort((a, b) => a.order - b.order);
    expect(sorted[0]?.label).toBe("login");
    expect(sorted[1]?.label).toBe("loginResponse");
  });

  it("parset message type correct (synchCall → sync, reply → return)", () => {
    const diagram = parseSequenceXmi(SEQUENCE_XMI);

    const login = diagram.messages.find((m) => m.label === "login");
    expect(login?.type).toBe("sync");

    const response = diagram.messages.find((m) => m.label === "loginResponse");
    expect(response?.type).toBe("return");
  });

  it("parset sender en ontvanger van berichten correct", () => {
    const diagram = parseSequenceXmi(SEQUENCE_XMI);

    const login = diagram.messages.find((m) => m.label === "login");
    expect(login?.from).toBe("ll-user");
    expect(login?.to).toBe("ll-server");
  });
});

// ─── detectDiagramType tests ──────────────────────────────────────────────────

describe("detectDiagramType — sequence", () => {
  it("herkent sequence XMI op basis van uml:Interaction", () => {
    expect(detectDiagramType(SEQUENCE_XMI)).toBe("sequence");
  });
});

// ─── Viewer integration ───────────────────────────────────────────────────────

describe("Viewer — sequence diagram", () => {
  let container: HTMLDivElement;
  let viewer: Viewer;

  beforeEach(() => {
    container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "600px";
    document.body.appendChild(container);
    viewer = new Viewer({ container });
  });

  afterEach(() => {
    viewer.destroy();
    container.remove();
  });

  it("importXml met sequence XMI voltooit zonder error", async () => {
    await expect(viewer.importXml(SEQUENCE_XMI)).resolves.toBeUndefined();
  });

  it("getDetectedType() geeft 'sequence' terug na importXml", async () => {
    await viewer.importXml(SEQUENCE_XMI);
    expect(viewer.getDetectedType()).toBe("sequence");
  });
});
