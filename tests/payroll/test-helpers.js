import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

export function createLocalStorage() {
    const data = new Map();
    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        removeItem(key) {
            data.delete(key);
        },
        clear() {
            data.clear();
        }
    };
}

export function loadPayrollScripts(extraFiles = []) {
    const context = {
        console: {
            log: console.log,
            warn: console.warn,
            error() {}
        },
        localStorage: createLocalStorage(),
        setTimeout(fn) {
            fn();
        },
        URL: {
            createObjectURL() {
                return 'blob:test';
            },
            revokeObjectURL() {}
        },
        document: {
            body: {
                appendChild() {},
                removeChild() {}
            },
            createElement(tagName) {
                if (tagName === 'a') {
                    return {
                        href: '',
                        download: '',
                        click() {}
                    };
                }
                if (tagName === 'div') {
                    return { textContent: '', innerHTML: '' };
                }
                return {};
            },
            getElementById() {
                return null;
            },
            querySelector() {
                return null;
            },
            querySelectorAll() {
                return [];
            }
        },
        Blob: class BlobMock {
            constructor(parts, options) {
                this.parts = parts;
                this.options = options;
                context.__lastBlob = this;
            }
        }
    };

    vm.createContext(context);

    const root = resolve('payroll');
    const storageSource = readFileSync(resolve(root, 'storage.js'), 'utf8');
    vm.runInContext(storageSource + '\nglobalThis.PayrollStorage = PayrollStorage;', context);

    for (const file of extraFiles) {
        const source = readFileSync(resolve(root, file), 'utf8');
        const globalMap = {
            'utils.js': 'PayrollUtils',
            'state-machine.js': 'PayrollStateMachine',
            'payroll-context.js': 'PayrollContext'
        };
        const globalName = globalMap[file] || null;
        vm.runInContext(source + (globalName ? '\nglobalThis.' + globalName + ' = ' + globalName + ';' : ''), context);
    }

    return context;
}

export function loadPayrollUtils() {
    const context = loadPayrollScripts(['utils.js']);
    return context.PayrollUtils;
}

export function validEmployee(overrides = {}) {
    return {
        id: 'emp-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        ppsNumber: '1234567A',
        familyStatus: 'single',
        annualGross: 50000,
        payType: 'salaried',
        prsiClass: 'A1',
        isActive: true,
        ...overrides
    };
}

export function validRun(overrides = {}) {
    return {
        id: 'run-1',
        status: 'committed',
        taxYear: '2026',
        runDate: '2026-03-15',
        frequency: 'monthly',
        entries: [
            {
                employeeId: 'emp-1',
                payFrequency: 'monthly',
                grossPay: 4000,
                taxCreditsUsed: 333.33,
                paye: 500
            }
        ],
        ...overrides
    };
}