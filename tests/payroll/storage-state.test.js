import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

function createLocalStorage() {
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
        },
        _dump() {
            return Object.fromEntries(data.entries());
        }
    };
}

function loadPayrollScripts(extraFiles = []) {
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
                return {};
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
        const globalName = file === 'state-machine.js' ? 'PayrollStateMachine' : null;
        vm.runInContext(source + (globalName ? '\nglobalThis.' + globalName + ' = ' + globalName + ';' : ''), context);
    }

    return context;
}

function validEmployee(overrides = {}) {
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

describe('Payroll storage and state regressions', () => {
    it('exports and clears the tax credits ledger with company data', () => {
        const context = loadPayrollScripts();
        const storage = context.PayrollStorage;
        const companyId = storage.loadCompanies()[0].id;
        const ledger = {
            'emp-1': {
                2026: {
                    annualTaxCredits: 4000,
                    taxCreditsUsed: 1000,
                    remaining: 3000,
                    cutOffPoint: 44000,
                    copUsed: 12500,
                    copRemaining: 31500,
                    source: 'rpn',
                    lastUpdated: '2026-01-01T00:00:00.000Z'
                }
            }
        };

        expect(storage.saveTaxCreditsLedger(companyId, ledger)).toBe(true);
        storage.exportBackup();

        const payload = JSON.parse(context.__lastBlob.parts[0]);
        expect(payload.version).toBe('3.1');
        expect(payload.taxCreditsLedgerByCompany[companyId]).toEqual(ledger);

        storage.clearAllData();
        expect(storage.loadTaxCreditsLedger(companyId)).toEqual({});
    });

    it('rejects malformed company and employee data before saving', () => {
        const context = loadPayrollScripts();
        const storage = context.PayrollStorage;
        const companyId = storage.loadCompanies()[0].id;

        expect(storage.saveCompanies([{ id: '', name: 'Broken Co' }])).toBe(false);
        expect(storage.saveEmployees(companyId, [{ id: 'emp-1', firstName: 'Ada' }])).toBe(false);
    });

    it('keeps retrieved RPN tax credits idempotent across repeated retrievals', () => {
        const context = loadPayrollScripts(['utils.js', 'state-machine.js']);
        const storage = context.PayrollStorage;
        const stateMachine = context.PayrollStateMachine;
        const companyId = storage.loadCompanies()[0].id;

        storage.saveEmployees(companyId, [
            validEmployee({
                rpn: {
                    taxCredits: 4000
                }
            })
        ]);
        storage.savePayrollRun(companyId, {
            id: 'run-1',
            status: 'submitted',
            taxYear: '2026',
            entries: [
                {
                    employeeId: 'emp-1',
                    taxCreditsUsed: 1000
                }
            ]
        });

        stateMachine.init(companyId);
        stateMachine.retrieveRPN(companyId);
        const afterFirst = storage.loadEmployees(companyId)[0];
        expect(afterFirst.rpn.annualTaxCredits).toBe(4000);
        expect(afterFirst.rpn.taxCredits).toBe(3000);

        stateMachine.retrieveRPN(companyId);
        const afterSecond = storage.loadEmployees(companyId)[0];
        expect(afterSecond.rpn.annualTaxCredits).toBe(4000);
        expect(afterSecond.rpn.taxCredits).toBe(3000);
    });
});
