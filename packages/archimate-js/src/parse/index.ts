/**
 * Open Exchange Format (OEF) parser + serializer.
 *
 * OEF is de officiële, gecertificeerde interop-standaard voor ArchiMate sinds
 * juni 2018 (verplicht voor gecertificeerde tools — Archi, Modelio, Sparx,
 * BiZZdesign).
 *
 * - Bestandsextensie: `.xml`
 * - Spec: <https://pubs.opengroup.org/architecture/archimate4-doc/exchange-format/>
 *
 * M1 doel: round-trip groen op 20 referentiemodellen uit Open Group + OpenExchange-corpus.
 */

import { XMLParser, XMLBuilder } from "fast-xml-parser";

import type { ArchiModel } from "../types.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: false,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  indentBy: "  ",
});

/**
 * Parse OEF XML naar in-memory ArchiModel.
 *
 * M1-week-1: skeleton — implementatie volgt; werpt nu om consumers te dwingen
 * tot verifieerbare error-handling tijdens development.
 */
export function parseOpenExchange(xml: string): ArchiModel {
  // TODO M1: implementeer volledige OEF 3.2 + 4.0 parser.
  void parser;
  void xml;
  throw new Error(
    "parseOpenExchange: not yet implemented (M1 skeleton — week 1 deliverable)",
  );
}

/**
 * Serialize ArchiModel naar OEF XML.
 *
 * M1-week-1: skeleton.
 */
export function serializeOpenExchange(model: ArchiModel): string {
  // TODO M1: implementeer.
  void builder;
  void model;
  throw new Error(
    "serializeOpenExchange: not yet implemented (M1 skeleton — week 1 deliverable)",
  );
}
