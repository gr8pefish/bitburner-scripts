export const HGW_DIR = '/hacking/hgw/';
export const DIST_DIR = '/dist/';
export const SHARE_SCRIPT_LOCATION = DIST_DIR + 'share.js';

// 1 weaken = 4 hacks and 1 grow = 3.2 hacks
// Security increase per hack thread__: 0.002
// Security increase per grow thread__: 0.004
// Security decrease per weaken thread: 0.05
export const HWGW_CONSTANTS = {
    hack: {
        SCRIPT_LOCATION: HGW_DIR + 'hack.js',
        SEC_CHANGE: 0.002,
        RELATIVE_HACK_TIME: 1,
        RAM_COST: 1.7,
    },
    weaken1: {
        SCRIPT_LOCATION: HGW_DIR + 'weaken.js',
        SEC_CHANGE: 0.05,
        RELATIVE_HACK_TIME: 4,
        RAM_COST: 1.75,
    },
    grow: {
        SCRIPT_LOCATION: HGW_DIR + 'grow.js',
        SEC_CHANGE: 0.004,
        RELATIVE_HACK_TIME: 3.2,
        RAM_COST: 1.75,
    },
    weaken2: {
        SCRIPT_LOCATION: HGW_DIR + 'weaken.js',
        SEC_CHANGE: 0.05,
        RELATIVE_HACK_TIME: 4,
        RAM_COST: 1.75,
    },
}
//TODO: fragile, hwgw names need to match datatypes prepend exactly for controller batching job setup

export const HWGW_TYPES: string[] = Object.keys(HWGW_CONSTANTS);