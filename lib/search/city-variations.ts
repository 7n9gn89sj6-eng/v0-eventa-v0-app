/**
 * City name variants for Prisma `contains` OR (aligned with strict internal filter lists).
 */

export const EXECUTION_CITY_VARIATIONS: Record<string, string[]> = {
  melbourne: ["melb"],
  brunswick: ["brunswick east", "brunswick west"],
  "brunswick east": ["brunswick", "brunswick west"],
  "brunswick west": ["brunswick", "brunswick east"],
  brussels: ["bruxelles", "brussel", "bruselas"],
  athens: ["αθήνα", "athina", "athen"],
  rome: ["roma", "rom"],
  paris: ["paris"],
  milan: ["milano"],
  florence: ["firenze"],
  naples: ["napoli"],
  venice: ["venezia"],
  vienna: ["wien"],
  copenhagen: ["københavn", "kobenhavn"],
  prague: ["praha"],
  warsaw: ["warszawa"],
  budapest: ["budapest"],
  bucharest: ["bucurești", "bucuresti"],
}

export const STRICT_INTERNAL_CITY_VARIANTS: Record<string, string[]> = {
  melbourne: ["melbourne", "melb"],
  brunswick: ["brunswick", "brunswick east", "brunswick west"],
  "brunswick east": ["brunswick east", "brunswick", "brunswick west"],
  "brunswick west": ["brunswick west", "brunswick", "brunswick east"],
}
