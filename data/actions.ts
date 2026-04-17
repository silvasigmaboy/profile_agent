import "dotenv/config";

type CloudflareApiEnvelope<T> = {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  result: T;
};

type D1QueryResultRow = Record<string, unknown>;
type D1QueryStatementResult<T extends D1QueryResultRow> = {
  results?: T[];
};

const accountId = process.env.CF_ACCOUNT_ID;
const apiToken = process.env.CF_API_TOKEN;
const databaseId = process.env.CF_D1_DATABASE_ID ?? "";

if (!accountId || !apiToken || !databaseId) {
  throw new Error(
    "Missing CF_ACCOUNT_ID, CF_API_TOKEN, or CF_D1_DATABASE_ID in environment variables.",
  );
}

const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;

function toSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function cloudflareRequest<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json()) as CloudflareApiEnvelope<T>;

  if (!response.ok || !data.success) {
    const errorText = data.errors
      ?.map((e) => `${e.code}: ${e.message}`)
      .join(" | ");
    throw new Error(
      `Cloudflare API request failed (${response.status} ${response.statusText}) ${errorText ?? ""}`,
    );
  }

  return data.result;
}

async function runQuery<T extends D1QueryResultRow>(
  sql: string,
): Promise<D1QueryStatementResult<T>> {
  const result = await cloudflareRequest<D1QueryStatementResult<T>[]>(
    `/d1/database/${databaseId}/query`,
    "POST",
    { sql },
  );

  return result[0] ?? {};
}

export async function markKeywordFetched(keyword: string): Promise<boolean> {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return false;
  }

  await runQuery(
    `UPDATE keywords SET fetched = 1 WHERE keyword = ${toSqlString(normalizedKeyword)};`,
  );

  return true;
}

export async function getRandomUnfetchedKeyword(): Promise<string | null> {
  const result = await runQuery<{ keyword: string }>(
    "SELECT keyword FROM keywords WHERE fetched = 0 ORDER BY RANDOM() LIMIT 1;",
  );

  return result.results?.[0]?.keyword ?? null;
}

export async function saveUrls(
  keyword: string,
  urls: string[],
): Promise<boolean> {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return false;
  }

  const uniqueUrls = [
    ...new Set(urls.map((url) => url.trim()).filter(Boolean)),
  ];
  const urlsJson = JSON.stringify(uniqueUrls);

  await runQuery(
    `UPDATE keywords SET urls = ${toSqlString(urlsJson)} WHERE keyword = ${toSqlString(normalizedKeyword)};`,
  );

  return true;
}

export async function saveQuestions(
  keyword: string,
  questions: string[],
): Promise<boolean> {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return false;
  }

  const uniqueQuestions = [
    ...new Set(questions.map((question) => question.trim()).filter(Boolean)),
  ];
  const questionsJson = JSON.stringify(uniqueQuestions);

  await runQuery(
    `UPDATE keywords SET questions = ${toSqlString(questionsJson)} WHERE keyword = ${toSqlString(normalizedKeyword)};`,
  );

  return true;
}

export async function saveSearchQueries(
  keyword: string,
  queries: string[],
): Promise<boolean> {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return false;
  }

  const uniqueQueries = [
    ...new Set(queries.map((query) => query.trim()).filter(Boolean)),
  ];
  const queriesJson = JSON.stringify(uniqueQueries);

  await runQuery(
    `UPDATE keywords SET search_queries = ${toSqlString(queriesJson)} WHERE keyword = ${toSqlString(normalizedKeyword)};`,
  );

  return true;
}
