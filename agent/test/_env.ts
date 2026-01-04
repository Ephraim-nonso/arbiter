export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required in agent/.env`);
  return v;
}

export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v : undefined;
}


