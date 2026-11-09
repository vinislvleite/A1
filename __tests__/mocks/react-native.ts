export const alertCalls: { title: string; message?: string }[] = [];

export const NativeModules: Record<string, unknown> = {
  SQLite: {},
};

export const Platform = {
  OS: 'android' as const,
  select<T>(spec: { android?: T; default?: T }): T | undefined {
    return spec.android ?? spec.default;
  },
};

export const Alert = {
  alert(title: string, message?: string): void {
    alertCalls.push({ title, message });
  },
};
