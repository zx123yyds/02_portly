import type { PortEntry } from '../types';

export interface PortGroup {
  primary: PortEntry;
  ports: PortEntry[];
}

export function groupPortsByProcess(ports: PortEntry[]): PortGroup[] {
  const groups = new Map<string, PortEntry[]>();

  for (const port of ports) {
    const key = groupKey(port);
    const group = groups.get(key);
    if (group) {
      group.push(port);
    } else {
      groups.set(key, [port]);
    }
  }

  return [...groups.values()].map((group) => ({
    primary: group[0],
    ports: group
  }));
}

function groupKey(port: PortEntry): string {
  const appPath = extractApplicationPath(port.cwd);
  if (appPath || isConcreteAppCommand(port.command)) {
    return ['app', appPath || '', normalize(port.command), normalize(port.name), normalize(port.project)].join('|');
  }

  return ['process', port.pid, normalize(port.command), normalize(port.cwd), normalize(port.name), normalize(port.project)].join('|');
}

function extractApplicationPath(value: string): string {
  const match = value.match(/(\/Applications\/.*?\.app)(?:\/|$)/);
  return match?.[1] ?? '';
}

function isConcreteAppCommand(command: string): boolean {
  return command.trim().length > 0 && !/^(node|npm|pnpm|yarn|bun|deno|python|python3|ruby|n|electron)$/i.test(command);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
