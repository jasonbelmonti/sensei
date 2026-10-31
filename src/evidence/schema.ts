export const EVIDENCE_SCHEMA = `
CREATE TABLE evidence_observations (
  evidence_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  session_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('human','assistant','tool')),
  text TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  observation_json TEXT NOT NULL CHECK(json_valid(observation_json))
);
CREATE INDEX evidence_turn_idx ON evidence_observations(provider,session_id,turn_id);
CREATE TABLE evidence_sources (
  provider TEXT NOT NULL,
  file_path TEXT NOT NULL,
  digest TEXT NOT NULL,
  generation INTEGER NOT NULL,
  availability TEXT NOT NULL,
  PRIMARY KEY(provider,file_path)
);
CREATE TABLE evidence_locations (
  evidence_id TEXT NOT NULL REFERENCES evidence_observations(evidence_id),
  file_path TEXT NOT NULL,
  source_digest TEXT NOT NULL,
  line INTEGER NOT NULL,
  byte_offset INTEGER NOT NULL,
  PRIMARY KEY(evidence_id,file_path,source_digest,line)
);
CREATE TABLE evidence_state (id INTEGER PRIMARY KEY CHECK(id=1), source_generation INTEGER NOT NULL);
INSERT INTO evidence_state VALUES(1,0);
`;
