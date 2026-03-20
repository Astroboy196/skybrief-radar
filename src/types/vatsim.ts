// ============================================================
// VATSIM Data API v3 — Complete Type Definitions
// Source: https://data.vatsim.net/v3/vatsim-data.json
// ============================================================

/** Top-level VATSIM data feed response */
export interface VatsimDataFeed {
  general: VatsimGeneral;
  pilots: VatsimPilot[];
  controllers: VatsimController[];
  atis: VatsimAtis[];
  servers: VatsimServer[];
  prefiles: VatsimPrefile[];
  facilities: VatsimFacilityRef[];
  ratings: VatsimRatingRef[];
  pilot_ratings: VatsimPilotRatingRef[];
  military_ratings: VatsimMilitaryRatingRef[];
}

export interface VatsimGeneral {
  version: number;
  update_timestamp: string;
  connected_clients: number;
  unique_users: number;
}

/** A pilot currently connected to the VATSIM network */
export interface VatsimPilot {
  cid: number;
  name: string;
  callsign: string;
  server: string;
  pilot_rating: number;
  military_rating: number;
  latitude: number;
  longitude: number;
  altitude: number;
  groundspeed: number;
  transponder: string;
  heading: number;
  qnh_i_hg: number;
  qnh_mb: number;
  flight_plan: VatsimFlightPlan | null;
  logon_time: string;
  last_updated: string;
}

export interface VatsimFlightPlan {
  flight_rules: 'I' | 'V';
  aircraft: string;
  aircraft_faa: string;
  aircraft_short: string;
  departure: string;
  arrival: string;
  alternate: string;
  deptime: string;
  enroute_time: string;
  fuel_time: string;
  remarks: string;
  route: string;
  revision_id: number;
  assigned_transponder: string;
}

/** An ATC controller currently connected */
export interface VatsimController {
  cid: number;
  name: string;
  callsign: string;
  frequency: string;
  facility: number;
  rating: number;
  server: string;
  visual_range: number;
  text_atis: string[] | null;
  logon_time: string;
  last_updated: string;
}

/** A dedicated ATIS station */
export interface VatsimAtis extends VatsimController {
  atis_code: string;
}

export interface VatsimServer {
  ident: string;
  hostname_or_ip: string;
  location: string;
  name: string;
  client_connections_allowed: boolean;
  is_sweatbox: boolean;
}

export interface VatsimPrefile {
  cid: number;
  name: string;
  callsign: string;
  flight_plan: VatsimFlightPlan;
  last_updated: string;
}

/** Reference types included in the feed */
export interface VatsimFacilityRef {
  id: number;
  short: string;
  long: string;
}

export interface VatsimRatingRef {
  id: number;
  short: string;
  long: string;
}

export interface VatsimPilotRatingRef {
  id: number;
  short_name: string;
  long_name: string;
}

export interface VatsimMilitaryRatingRef {
  id: number;
  short_name: string;
  long_name: string;
}

// ============================================================
// VATSIM Core API v2 — Member Statistics
// Source: GET /v2/members/:member_id/stats
// ============================================================

export interface VatsimMemberStats {
  id: string;
  atc: number;
  pilot: number;
  s1: number;
  s2: number;
  s3: number;
  c1: number;
  c2: number;
  c3: number;
  i1: number;
  i2: number;
  i3: number;
  sup: number;
  adm: number;
}

// ============================================================
// VATSIM Transceiver / Audio Data
// Source: GET /v3/transceivers-data.json
// ============================================================

export interface VatsimTransceiverEntry {
  callsign: string;
  transceivers: VatsimTransceiver[];
}

export interface VatsimTransceiver {
  id: number;
  frequency: number;
  latDeg: number;
  lonDeg: number;
  heightMslM: number;
  heightAglM: number;
}

// ============================================================
// VATSIM METAR API
// Source: GET https://metar.vatsim.net/:icao?format=json
// ============================================================

export interface VatsimMetar {
  id: string;
  metar: string;
}

// ============================================================
// Rating Constants
// ============================================================

export const PILOT_RATINGS: Record<number, { short: string; long: string }> = {
  0:  { short: 'P0',   long: 'No Rating' },
  1:  { short: 'PPL',  long: 'Private Pilot License' },
  3:  { short: 'IR',   long: 'Instrument Rating' },
  7:  { short: 'CMEL', long: 'Commercial Multi-Engine' },
  15: { short: 'ATPL', long: 'Airline Transport Pilot' },
  31: { short: 'FI',   long: 'Flight Instructor' },
  63: { short: 'FE',   long: 'Flight Examiner' },
};

export const CONTROLLER_RATINGS: Record<number, { short: string; long: string }> = {
  1:  { short: 'OBS', long: 'Observer' },
  2:  { short: 'S1',  long: 'Tower Trainee' },
  3:  { short: 'S2',  long: 'Tower Controller' },
  4:  { short: 'S3',  long: 'TMA Controller' },
  5:  { short: 'C1',  long: 'Enroute Controller' },
  6:  { short: 'C2',  long: 'Senior Controller' },
  7:  { short: 'C3',  long: 'Senior Controller' },
  8:  { short: 'I1',  long: 'Instructor' },
  9:  { short: 'I2',  long: 'Senior Instructor' },
  10: { short: 'I3',  long: 'Senior Instructor' },
  11: { short: 'SUP', long: 'Supervisor' },
  12: { short: 'ADM', long: 'Administrator' },
};

export const FACILITY_TYPES: Record<number, string> = {
  0: 'OBS',
  1: 'FSS',
  2: 'DEL',
  3: 'GND',
  4: 'TWR',
  5: 'APP',
  6: 'CTR',
};
