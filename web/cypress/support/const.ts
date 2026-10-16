//set all your shared const here
// export const url = 'http://localhost:9000/netflow-traffic';
export const url = 'http://localhost:9001';
export const namespace = 'netobserv{enter}';
export const pod = 'flowlogs-pipeline';
export const waitTime = 3000;

// overview specific config
export const availablePanelsCount = 52;
export const defaultPanelsCount = 2;

// table specific config
export const availableColumnGroupCount = 29;
export const availableColumnCount = 57;
export const defaultColumnGroupCount = 6;
export const defaultColumnCount = 10;

export const DEFAULT_RETRY_OPTIONS = { retries: 3, interval: 10000 };
