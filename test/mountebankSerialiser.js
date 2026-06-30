import * as fs from "fs";

const pacticipant = "pactflow-example-bi-directional-consumer-mountebank";
const provider = "pactflow-example-bi-directional-provider-dredd";

const filePath = `./pacts/${pacticipant}-${
  process.env.PACT_PROVIDER || provider
}.json`;

const pjson = require("../package.json")

const defaultPact = {
  consumer: { name: pacticipant },
  provider: { name: process.env.PACT_PROVIDER || provider },
  interactions: [],
  metadata: {
    pactSpecification: {
      version: "2.0.0",
    },
    client: {
      name: "pact-mountebank-adapter",
      version: pjson.version,
    },
  },
};

// The consumer sends `Authorization: Bearer <ISO timestamp>`, which changes on
// every run. Recording the literal value makes the contract mutate each run
// (and is meaningless to the provider), so normalise it to a stable placeholder.
const AUTH_PLACEHOLDER = "Bearer <token>";

const normalizeRequestHeaders = (headers) => {
  if (!headers || typeof headers !== "object") return headers;
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = key.toLowerCase() === "authorization" ? AUTH_PLACEHOLDER : value;
  }
  return out;
};

// Product fields the consumer cares about by TYPE, not exact value
// (see src/product.js and the Product schema in pactflow/oas/products.yml).
const TYPE_MATCHED_FIELDS = ["id", "type", "price"];

// Build Pact v2 type matchers for product-shaped response bodies, so that
// cross-contract verification matches on each field's TYPE rather than the
// exact recorded value (e.g. a provider returning a different price/id is
// still valid). Handles both a single Product object and an array of them;
// returns undefined for bodies that aren't product-shaped (errors, 404s).
const buildResponseMatchingRules = (body) => {
  const rules = {};

  const addRules = (prefix, sample) => {
    if (sample && typeof sample === "object" && !Array.isArray(sample)) {
      TYPE_MATCHED_FIELDS.forEach((field) => {
        if (sample[field] !== undefined) {
          rules[`${prefix}.${field}`] = { match: "type" };
        }
      });
    }
  };

  if (Array.isArray(body)) {
    addRules("$.body[*]", body[0]);
  } else {
    addRules("$.body", body);
  }

  return Object.keys(rules).length ? rules : undefined;
};

// Read in the MB stubs, and convert to a Pact file
export const mbMatchesToPact = (imposters) => {
  const pact = readPactFileOrDefault();

  const matches = imposters.stubs.map((imposter) => {
    return (imposter.matches || []).map((match) => {
      const responseBody = match.response.body ? JSON.parse(match.response.body) : undefined;
      const matchingRules = buildResponseMatchingRules(responseBody);

      return {
        description: `mb_${match.request.method}_${match.request.path}_${match.response.statusCode}`,
        request: {
          method: match.request.method,
          path: match.request.path,
          body: match.request.body ? JSON.parse(match.request.body) : undefined,
          query: match.request.query ? new URLSearchParams(match.request.query).toString() : undefined,
          headers: normalizeRequestHeaders(match.request.headers),
        },
        response: {
          status: match.response.statusCode,
          headers: match.response.headers,
          body: responseBody,
          ...(matchingRules ? { matchingRules } : {}),
        },
      };
    });
  });

  pact.interactions = [...pact.interactions, ...matches.flat()];

  writePact(pact);
};

// Dedupe by interaction content (no longer by timestamp, which has been
// removed). `afterEach` re-reads the imposter's full match list, so the same
// interaction is appended multiple times in a run; identical entries collapse,
// while genuinely different interactions are preserved.
const removeDuplicates = (pact) => {
  const seen = new Set();

  pact.interactions = pact.interactions.reduce((acc, interaction) => {
    const key = JSON.stringify(interaction);
    if (!seen.has(key)) {
      seen.add(key);
      acc.push(interaction);
    }

    return acc;
  }, []);

  return pact;
};

const writePact = (pact) => {
  createPactDir();
  const cleanPact = removeDuplicates(pact);

  fs.writeFileSync(filePath, JSON.stringify(cleanPact));
};

const createPactDir = () => {
  try {
    fs.mkdirSync("./pacts");
  } catch {
    // likely dir already exists
  }
};

const readPactFileOrDefault = () => {
  let pact = {};

  try {
    const res = fs.readFileSync(filePath);
    pact = JSON.parse(res.toString("utf8"));
  } catch {
    pact = defaultPact;
  }

  return pact;
};
