/**
 * Backend mirror of mobile electrical Notes/Voice parser.
 * Keep in sync with mobile/utils/subcontractorTrade/electricalPlanConvergence.ts.
 */

const WORD_COUNTS = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const COUNT_TOKEN = '(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';

const QUANTITY_ITEM_IDS = {
  mainPanelCount: 'electrical_main_panel',
  subpanelCount: 'electrical_subpanel',
  panelUpgradeCount: 'electrical_panel_upgrade',
  serviceUpgradeCount: 'electrical_service_upgrade',
  standardCircuitCount: 'electrical_standard_circuit',
  dedicated20aCircuitCount: 'electrical_dedicated_20a',
  circuit30aCount: 'electrical_circuit_30a',
  circuit40aCount: 'electrical_circuit_40a',
  circuit50aCount: 'electrical_circuit_50a',
  circuit60aPlusCount: 'electrical_circuit_60a_plus',
  standardReceptacleCount: 'electrical_standard_receptacle',
  gfciReceptacleCount: 'electrical_gfci_receptacle',
  afciReceptacleCount: 'electrical_afci_receptacle',
  exteriorReceptacleCount: 'electrical_exterior_receptacle',
  floorReceptacleCount: 'electrical_floor_receptacle',
  usbReceptacleCount: 'electrical_usb_receptacle',
  receptacle240vCount: 'electrical_240v_receptacle',
  singlePoleSwitchCount: 'electrical_single_pole_switch',
  threeWaySwitchCount: 'electrical_3way_switch',
  fourWaySwitchCount: 'electrical_4way_switch',
  dimmerSwitchCount: 'electrical_dimmer_switch',
  occupancySwitchCount: 'electrical_occupancy_switch',
  smartSwitchCount: 'electrical_smart_switch',
  standardFixtureCount: 'electrical_standard_fixture',
  recessedLightCount: 'electrical_recessed_light',
  pendantLightCount: 'electrical_pendant_light',
  decorativeLightCount: 'electrical_decorative_light',
  exteriorLightCount: 'electrical_exterior_light',
  undercabinetLightCount: 'electrical_undercabinet_light',
  ceilingFanCount: 'electrical_ceiling_fan',
  bathExhaustFanCount: 'electrical_bath_exhaust_fan',
  rangeHookupCount: 'electrical_range_hookup',
  dryerHookupCount: 'electrical_dryer_hookup',
  dishwasherHookupCount: 'electrical_dishwasher_hookup',
  disposalHookupCount: 'electrical_disposal_hookup',
  microwaveHookupCount: 'electrical_microwave_hookup',
  refrigeratorHookupCount: 'electrical_refrigerator_hookup',
  waterHeaterHookupCount: 'electrical_water_heater_hookup',
  hvacHookupCount: 'electrical_hvac_hookup',
  evChargerHookupCount: 'electrical_ev_charger_hookup',
  smokeDetectorCount: 'electrical_smoke_detector',
  coDetectorCount: 'electrical_co_detector',
  doorbellCount: 'electrical_doorbell',
  cat6DropCount: 'electrical_cat6_drop',
  tvCoaxCount: 'electrical_tv_coax',
  securityPrewireCount: 'electrical_security_prewire',
  cameraPrewireCount: 'electrical_camera_prewire',
  deviceRemovalCount: 'electrical_device_removal',
  fixtureRemovalCount: 'electrical_fixture_removal',
  relocateCount: 'electrical_relocate',
  abandonedCircuitCount: 'electrical_abandoned_circuit',
};

function parseCountToken(raw) {
  const token = String(raw || '').toLowerCase();
  if (WORD_COUNTS[token] != null) return WORD_COUNTS[token];
  const n = Number(String(token).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function matchCount(text, pattern) {
  const match = String(text || '').match(pattern);
  if (!match) return null;
  return parseCountToken(match[1]) || 1;
}

function looksLikeElectricalNotes(text) {
  return /\b(electrical|outlet|receptacle|gfci|afci|switch(?:es)?|dimmers?|recessed|canless|wafer|vanity\s+lights?|pendant|chandelier|panel|subpanel|circuits?|ceiling\s+fan|amp(?:ere)?s?|\d+\s*a\b|service|ev\s+charger|cat\s*6|smoke\s+detector|doorbell|cameras?|prewire|poe|remove|removal|relocat|abandon|conduit|rough[\s-]?in|finished[\s-]?wall|fish(?:ing)?\s+(?:in\s+)?walls?)\b/i.test(
    text
  );
}

function parseProjectCondition(text) {
  const n = String(text || '').toLowerCase();
  if (/\bnew\s+construction\b|\bnew\s+build\b|\bfull\s+rough(?:[\s-]?in)?\b/.test(n)) {
    return 'new_construction';
  }
  if (/\bfinished[\s-]?wall\b|\bfish(?:ing)?\s+(?:in\s+)?(?:finished\s+)?walls?\b|\bretrofit\b/.test(n)) {
    return 'finished_wall_service';
  }
  if (/\bremodel\b|\bopen[\s-]?wall\b/.test(n)) {
    return 'remodel_open_wall';
  }
  return null;
}

function hasServiceUpgradeLanguage(text) {
  return /\bservice\s+upgrade\b|\bupgrade\s+(?:the\s+|an\s+|existing\s+)?(?:\d+\s*(?:amp(?:ere)?s?|a)\s+)?service\b|\b\d+\s*(?:amp(?:ere)?s?|a)\s+(?:service\s+)?(?:to|→)\s*\d+\s*(?:amp(?:ere)?s?|a)\b|\bupgrade\s+existing\s+\d+\s*(?:amp(?:ere)?s?|a)\b|\bmeter[\s/-]?main\s+upgrade\b/i.test(
    text
  );
}

function hasPanelUpgradeLanguage(text) {
  return /\bpanel\s+upgrade|\bupgrade\s+(?:the\s+|an\s+|existing\s+)?(?:\d+\s*amp(?:ere)?s?\s+)?panel\b|\breplace(?:ment)?\s+(?:the\s+)?(?:existing\s+)?(?:main\s+)?panel\b/i.test(
    text
  );
}

function hasIndependentMainPanelLanguage(text) {
  return /\b(?:install|new)\s+(?:a\s+)?(?:\d+\s*amp(?:ere)?s?\s+)?(?:main\s+)?panel\b|\bnew\s+main\s+panel\b/i.test(
    text
  );
}

function hasIndependentServicePanelJoiner(text) {
  return /\balso\b|\bin addition\b|\bplus\b|\bas well as\b/i.test(text);
}

function parseServiceAmperageRange(text) {
  const source = String(text || '');
  const range = source.match(
    /(\d+)\s*(?:amp(?:ere)?s?|a)\s+(?:service\s+)?(?:to|→|-)\s*(\d+)\s*(?:amp(?:ere)?s?|a)\b/i
  );
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    return {
      from: Number.isFinite(from) && from > 0 ? from : null,
      to: Number.isFinite(to) && to > 0 ? to : null,
    };
  }
  const toOnly = source.match(/\b(?:to|→)\s*(\d+)\s*(?:amp(?:ere)?s?|a)\b/i);
  if (toOnly) {
    const to = Number(toOnly[1]);
    return {
      from: null,
      to: Number.isFinite(to) && to > 0 ? to : null,
    };
  }
  return { from: null, to: null };
}

function applyElectricalServicePanelOwnership(parsed, notes) {
  const text = String(notes || '');
  const next = { ...parsed };
  const range = parseServiceAmperageRange(text);
  if (range.to) next.serviceAmperage = range.to;
  if (range.from) next.existingServiceAmperage = range.from;

  const serviceLang = hasServiceUpgradeLanguage(text);
  const panelLang = hasPanelUpgradeLanguage(text);
  const newMainLang = hasIndependentMainPanelLanguage(text);
  const joiner = hasIndependentServicePanelJoiner(text);

  if (serviceLang) {
    if (!(Number(next.serviceUpgradeCount) > 0)) next.serviceUpgradeCount = 1;
    if (!joiner || !newMainLang) delete next.mainPanelCount;
    else if (!(Number(next.mainPanelCount) > 0)) next.mainPanelCount = 1;
    if (!joiner || !panelLang) delete next.panelUpgradeCount;
    else if (!(Number(next.panelUpgradeCount) > 0)) next.panelUpgradeCount = 1;
  } else if (panelLang) {
    if (!(Number(next.panelUpgradeCount) > 0)) next.panelUpgradeCount = 1;
    if (!joiner || !newMainLang) delete next.mainPanelCount;
    delete next.serviceUpgradeCount;
  }

  if (/\boutdoor\s+panel|\bexterior\s+panel|\bnema\s*3r\b/i.test(text)) {
    next.electricalPanelLocation = 'outdoor';
  } else if (/\bindoor\s+panel\b/i.test(text)) {
    next.electricalPanelLocation = 'indoor';
  }
  if (/\bmeter[\s/-]?main\b|\bcombo\s+panel\b/i.test(text)) {
    next.electricalMeterMainCombo = true;
  }
  return next;
}

function parseElectricalMeasurementsFromNotes(notes) {
  const text = String(notes || '').trim();
  if (!text || !looksLikeElectricalNotes(text)) return {};

  const out = {};
  const assign = (key, quantity) => {
    if (quantity == null || quantity <= 0) return;
    out[key] = (out[key] || 0) + quantity;
  };

  const panelMatch = text.match(
    /(\d+)\s*(?:amp(?:ere)?s?|a)\s+(?:main\s+)?panel|\b(?:main\s+)?panel\s*(?:is|:)?\s*(\d+)\s*(?:amp(?:ere)?s?|a)\b/i
  );
  if (panelMatch) {
    const amps = Number(panelMatch[1] || panelMatch[2]);
    if (Number.isFinite(amps) && amps > 0) out.serviceAmperage = amps;
  } else {
    const ampOnly = text.match(/\b(\d+)\s*(?:amp(?:ere)?s?|a)\s+(?:service|panel)\b/i);
    if (ampOnly) {
      const amps = Number(ampOnly[1]);
      if (Number.isFinite(amps) && amps > 0) out.serviceAmperage = amps;
    }
  }

  if (/\bsub[\s-]?panels?\b/i.test(text)) {
    assign('subpanelCount', matchCount(text, new RegExp(`${COUNT_TOKEN}\\s*sub[\\s-]?panels?\\b|\\bsub[\\s-]?panels?\\b`, 'i')) || 1);
  }
  if (/\bpanel\s+upgrade|\bupgrade\s+(?:the\s+)?panel\b/i.test(text)) {
    assign('panelUpgradeCount', 1);
  } else if (/\bservice\s+upgrade|\bupgrade\s+(?:the\s+)?service\b/i.test(text)) {
    assign('serviceUpgradeCount', 1);
  } else if (/\b(?:main\s+)?panels?\b/i.test(text) && !/\bsub[\s-]?panel\b/i.test(text)) {
    assign('mainPanelCount', matchCount(text, new RegExp(`${COUNT_TOKEN}\\s*(?:main\\s+)?panels?\\b|\\b(?:install|new)\\s+(?:a\\s+)?(?:\\d+\\s*amp(?:ere)?s?\\s+)?(?:main\\s+)?panel\\b`, 'i')) || 1);
  }

  const owned = applyElectricalServicePanelOwnership(out, text);
  for (const key of Object.keys(out)) {
    if (!(key in owned)) delete out[key];
  }
  Object.assign(out, owned);

  const clauses = text
    .split(/(?<=[.;\n])\s+|\s*(?:,|and)\s+(?=\d|a\b|an\b|one|two|three|four|five)/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const searchClauses = clauses.length ? clauses : [text];

  for (const clause of searchClauses) {
    if (/\brange(?:\s+circuit|\s+hookup)|electric\s+range/i.test(clause)) {
      assign('rangeHookupCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}?\\s*(?:\\d+\\s*amp(?:ere)?s?\\s+)?(?:electric\\s+)?range(?:\\s+circuit|\\s+hookup)?`, 'i')) || 1);
      continue;
    }
    if (/\bdryer(?:\s+circuit|\s+hookup)?/i.test(clause)) {
      assign('dryerHookupCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}?\\s*(?:electric\\s+)?dryer`, 'i')) || 1);
      continue;
    }
    if (/\bdishwasher/i.test(clause)) {
      assign('dishwasherHookupCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}?\\s*dishwasher`, 'i')) || 1);
      continue;
    }
    if (/\b(?:garbage\s+)?disposal/i.test(clause)) {
      assign('disposalHookupCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}?\\s*(?:garbage\\s+)?disposal`, 'i')) || 1);
      continue;
    }
    if (/\bmicrowave/i.test(clause)) {
      assign('microwaveHookupCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}?\\s*(?:dedicated\\s+)?microwave`, 'i')) || 1);
      continue;
    }
    if (/\b(?:dedicated\s+)?(?:refrigerator|fridge)(?:\s+dedicated)?(?:\s+circuit|\s+hookup)/i.test(clause)) {
      assign('refrigeratorHookupCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}?\\s*(?:dedicated\\s+)?(?:refrigerator|fridge)`, 'i')) || 1);
      continue;
    }
    if (/\belectric\s+water[\s-]?heater|\bwater[\s-]?heater(?:\s+(?:circuit|hookup|electrical\s+connection))/i.test(clause) && !/\bgas\b/i.test(clause)) {
      assign('waterHeaterHookupCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}?\\s*(?:electric\\s+)?water[\\s-]?heater`, 'i')) || 1);
      continue;
    }
    if (/\b(?:hvac|air[\s-]?handler|condenser)(?:\s+circuit|\s+hookup|\s+disconnect)/i.test(clause)) {
      assign('hvacHookupCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}?\\s*(?:hvac|air[\\s-]?handler|condenser)`, 'i')) || 1);
      continue;
    }
    if (/\bev\s+charger/i.test(clause)) {
      assign('evChargerHookupCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}?\\s*(?:ev\\s+charger|electric\\s+vehicle\\s+charger)`, 'i')) || 1);
      continue;
    }

    if (/\bdedicated\s+(?:20\s*amp(?:ere)?s?\s+)?circuits?/i.test(clause) && !/\b(?:30|40|50|60|70|80|100)\s*amp/i.test(clause)) {
      assign('dedicated20aCircuitCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*dedicated\\s+(?:20\\s*amp(?:ere)?s?\\s+)?circuits?\\b|\\bdedicated\\s+(?:20\\s*amp(?:ere)?s?\\s+)?circuits?\\b`, 'i')) || 1);
    } else if (/\b30\s*amp(?:ere)?s?\s+circuits?/i.test(clause) && !/\brange|dryer/i.test(clause)) {
      assign('circuit30aCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:dedicated\\s+)?30\\s*amp`, 'i')) || 1);
    } else if (/\b40\s*amp(?:ere)?s?\s+circuits?/i.test(clause)) {
      assign('circuit40aCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:dedicated\\s+)?40\\s*amp`, 'i')) || 1);
    } else if (/\b50\s*amp(?:ere)?s?\s+circuits?/i.test(clause) && !/\brange/i.test(clause)) {
      assign('circuit50aCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:dedicated\\s+)?50\\s*amp`, 'i')) || 1);
    } else if (/\b(?:60|70|80|100)\s*amp(?:ere)?s?\s+circuits?/i.test(clause) && !/\bev\s+charger/i.test(clause)) {
      assign('circuit60aPlusCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:dedicated\\s+)?(?:60|70|80|100)\\s*amp`, 'i')) || 1);
    } else if (/\b(?:standard\s+)?(?:15|20)\s*amp(?:ere)?s?\s+circuits?/i.test(clause) && !/\bdedicated\b/i.test(clause)) {
      assign('standardCircuitCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:standard\\s+)?(?:15|20)\\s*amp`, 'i')) || 1);
    } else if (
      new RegExp(`${COUNT_TOKEN}\\s*(?:new\\s+)?(?:branch\\s+)?circuits?\\b`, 'i').test(clause) &&
      !/\bdedicated\b|\b(?:30|40|50|60|70|80|100)\s*amp|\babandon/i.test(clause)
    ) {
      assign('standardCircuitCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:new\\s+)?(?:branch\\s+)?circuits?\\b`, 'i')) || 1);
    }

    const relocating = /\brelocat|\bmove(?:s|d)?\s+(?:an?\s+|the\s+|\d+\s+)?(?:existing\s+)?(?:switch|outlet|receptacle|fixture|device)/i.test(clause);
    const removingDevices = new RegExp(`\\b(?:remove|removal of)\\s+(?:${COUNT_TOKEN}\\s+)?(?:existing\\s+)?(?:outlets?|receptacles?|switches?|devices?)\\b`, 'i').test(clause);
    const removingFixtures = new RegExp(`\\b(?:remove|removal of)\\s+(?:${COUNT_TOKEN}\\s+)?(?:existing\\s+)?(?:(?:light\\s+)?fixtures?|(?:ceiling\\s+)?fans?)\\b`, 'i').test(clause);

    if (!relocating && !removingFixtures) {
      if (/\b(?:recessed|canless|wafer)\s+(?:lights?|lighting|cans?|fixtures?)/i.test(clause)) {
        assign('recessedLightCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:recessed|canless|wafer|can)\\s+(?:lights?|lighting|cans?|fixtures?)`, 'i')) || 1);
      } else if (/\bpendants?(?:\s+lights?|\s+fixtures?)?/i.test(clause)) {
        assign('pendantLightCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*pendants?`, 'i')) || 1);
      } else if (/\b(?:decorative|chandeliers?|heavy)\s+(?:lights?|fixtures?)|\bchandeliers?\b/i.test(clause)) {
        assign('decorativeLightCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:decorative|chandeliers?|heavy)`, 'i')) || 1);
      } else if (/\b(?:exterior|outdoor|porch)\s+(?:lights?|lighting|fixtures?)/i.test(clause)) {
        assign('exteriorLightCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:exterior|outdoor|porch)\\s+(?:lights?|lighting|fixtures?)`, 'i')) || 1);
      } else if (/\b(?:under[\s-]?cabinet|undercabinet)\s+(?:lights?|lighting)/i.test(clause)) {
        assign('undercabinetLightCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:under[\\s-]?cabinet|undercabinet)`, 'i')) || 1);
      } else if (/\b(?:standard\s+)?light\s+fixtures?|\bvanity\s+lights?/i.test(clause)) {
        assign('standardFixtureCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:standard\\s+|vanity\\s+)?(?:light\\s+)?fixtures?|${COUNT_TOKEN}\\s*vanity\\s+lights?`, 'i')) || 1);
      }

      if (/\bceiling\s+fans?/i.test(clause)) {
        assign('ceilingFanCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*ceiling\\s+fans?`, 'i')) || 1);
      } else if (/\b(?:bath(?:room)?\s+)?(?:exhaust|bath)\s+fans?/i.test(clause)) {
        assign('bathExhaustFanCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:bath(?:room)?\\s+)?(?:exhaust|bath)\\s+fans?`, 'i')) || 1);
      }
    }

    if (!relocating && !removingDevices) {
      if (/\b(?:exterior|outdoor)\s+(?:outlets?|receptacles?|gfci)/i.test(clause)) {
        assign('exteriorReceptacleCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:exterior|outdoor)`, 'i')) || 1);
      } else if (/\bafci(?:\s+outlets?|\s+receptacles?)?/i.test(clause)) {
        assign('afciReceptacleCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*afci`, 'i')) || 1);
      } else if (/\bgfci(?:\s+outlets?|\s+receptacles?)?/i.test(clause)) {
        assign('gfciReceptacleCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*gfci`, 'i')) || 1);
      } else if (/\bfloor\s+(?:outlets?|receptacles?)/i.test(clause)) {
        assign('floorReceptacleCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*floor\\s+(?:outlets?|receptacles?)`, 'i')) || 1);
      } else if (/\b(?:usb|usb[\s-]?c)\s+(?:outlets?|receptacles?)/i.test(clause)) {
        assign('usbReceptacleCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:usb|usb[\\s-]?c)`, 'i')) || 1);
      } else if (/\b(?:240\s*v(?:olt)?|220\s*v(?:olt)?)\s+(?:outlets?|receptacles?)/i.test(clause)) {
        assign('receptacle240vCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:240\\s*v(?:olt)?|220\\s*v(?:olt)?)`, 'i')) || 1);
      } else if (/\b(?:standard\s+)?(?:outlets?|receptacles?)\b/i.test(clause)) {
        assign('standardReceptacleCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:standard\\s+)?(?:outlets?|receptacles?)`, 'i')) || 1);
      }

      if (/\b(?:3|three)[\s-]?way\s+switch/i.test(clause)) {
        assign('threeWaySwitchCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:3|three)[\\s-]?way`, 'i')) || 1);
      } else if (/\b(?:4|four)[\s-]?way\s+switch/i.test(clause)) {
        assign('fourWaySwitchCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:4|four)[\\s-]?way`, 'i')) || 1);
      } else if (/\bdimmers?(?:\s+switch(?:es)?)?/i.test(clause)) {
        assign('dimmerSwitchCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*dimmers?`, 'i')) || 1);
      } else if (/\b(?:occupancy|vacancy|motion)\s+(?:sensor(?:s)?(?:\s+switch(?:es)?)?|switch(?:es)?)/i.test(clause)) {
        assign('occupancySwitchCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:occupancy|vacancy|motion)`, 'i')) || 1);
      } else if (/\bsmart\s+switch/i.test(clause)) {
        assign('smartSwitchCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*smart\\s+switch`, 'i')) || 1);
      } else if (/\b(?:standard\s+)?(?:single[\s-]?pole\s+)?switch(?:es)?\b/i.test(clause) && !/\bway\b|\bdimmer|\bsmart|\boccupancy/i.test(clause)) {
        assign('singlePoleSwitchCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:standard\\s+)?(?:single[\\s-]?pole\\s+)?switch(?:es)?`, 'i')) || 1);
      }
    }

    if (removingDevices) {
      assign(
        'deviceRemovalCount',
        matchCount(
          clause,
          new RegExp(`${COUNT_TOKEN}\\s*(?:remove|removal of)|(?:remove|removal of)\\s+${COUNT_TOKEN}`, 'i')
        ) || 1
      );
    }
    if (removingFixtures) {
      assign(
        'fixtureRemovalCount',
        matchCount(
          clause,
          new RegExp(`${COUNT_TOKEN}\\s*(?:remove|removal of)|(?:remove|removal of)\\s+${COUNT_TOKEN}`, 'i')
        ) || 1
      );
    }
    if (relocating) {
      assign('relocateCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:relocat(?:e|ion)|move(?:s|d)?)|(?:relocat(?:e|ion)|move(?:s|d)?)\\s+${COUNT_TOKEN}`, 'i')) || 1);
    }

    if (/\bsmoke(?:\s+detectors?|\s+alarms?)/i.test(clause)) {
      assign('smokeDetectorCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*smoke`, 'i')) || 1);
    }
    if (/\b(?:co|carbon\s+monoxide)(?:\s+detectors?|\s+alarms?)/i.test(clause)) {
      assign('coDetectorCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:co|carbon\\s+monoxide)`, 'i')) || 1);
    }
    if (/\bdoor\s*bells?/i.test(clause) && !/\b(?:video|ring|nest|camera)\s+door\s*bells?/i.test(clause)) {
      assign('doorbellCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*door\\s*bells?`, 'i')) || 1);
    }
    const cameraPrewire =
      (/\bcameras?\b/i.test(clause) &&
        /\b(?:prewire|pre[\s-]?wire|drops?|runs?|cables?|cat\s*6|low[\s-]?voltage)\b/i.test(clause)) ||
      /\b(?:video|ring|nest)\s+door\s*bells?\s+(?:prewire|pre[\s-]?wire|drops?)\b/i.test(clause);
    if (cameraPrewire) {
      assign(
        'cameraPrewireCount',
        matchCount(
          clause,
          new RegExp(
            `${COUNT_TOKEN}\\s*(?:(?:poe|ring|nest)\\s+)?cameras?|prewire\\s+${COUNT_TOKEN}\\s+(?:(?:poe|ring|nest)\\s+)?cameras?`,
            'i'
          )
        ) || 1
      );
    }
    const wholeHousePackage =
      /\b(?:whole[\s-]?house|structured\s+wiring(?:\s+package)?)\b/i.test(clause) &&
      !new RegExp(`${COUNT_TOKEN}\\s*(?:cat\\s*6|data|ethernet)\\s+(?:drops?|outlets?|jacks?|runs?)`, 'i').test(clause);
    if (
      /\b(?:cat\s*6|data|ethernet)\s+(?:drops?|outlets?|jacks?)/i.test(clause) &&
      !cameraPrewire &&
      !wholeHousePackage
    ) {
      assign('cat6DropCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:cat\\s*6|data|ethernet)`, 'i')) || 1);
    }
    if (/\b(?:tv|coax|rg6)\s+(?:outlets?|drops?|jacks?)/i.test(clause)) {
      assign('tvCoaxCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:tv|coax|rg6)`, 'i')) || 1);
    }
    if (/\b(?:security|alarm)\s+(?:prewire|pre[\s-]?wire)/i.test(clause) && !cameraPrewire) {
      assign('securityPrewireCount', matchCount(clause, new RegExp(`${COUNT_TOKEN}\\s*(?:security|alarm)`, 'i')) || 1);
    }
    if (/\babandon(?:ed)?\s+(?:\d+\s+|a\s+|an\s+|one\s+|two\s+)?circuits?/i.test(clause)) {
      assign(
        'abandonedCircuitCount',
        matchCount(
          clause,
          new RegExp(`${COUNT_TOKEN}\\s*abandon(?:ed)?\\s+circuits?|abandon(?:ed)?\\s+${COUNT_TOKEN}\\s+circuits?`, 'i')
        ) || 1
      );
    }
  }

  const condition = parseProjectCondition(text);
  if (condition) out.electricalProjectCondition = condition;
  if (/\brough(?:[\s-]?in)?\b/i.test(text)) out.electricalIncludeRough = true;
  if (/\btrim(?:[\s-]?out)?\b/i.test(text)) out.electricalIncludeTrim = true;
  if (/\bconduit\b/i.test(text)) out.electricalConduit = true;
  if (/\btrench(?:ing)?\b/i.test(text)) out.electricalTrenching = true;

  const itemQuantities = {};
  const electricalScope = [];
  for (const [key, itemId] of Object.entries(QUANTITY_ITEM_IDS)) {
    const quantity = Number(out[key]);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    itemQuantities[itemId] = {
      quantity,
      unit: 'each',
      quantitySource: 'notes',
    };
    electricalScope.push(itemId);
  }
  if (electricalScope.length) out.electricalScope = electricalScope;
  if (Object.keys(itemQuantities).length) out.itemQuantities = itemQuantities;

  return out;
}

module.exports = {
  parseElectricalMeasurementsFromNotes,
};
