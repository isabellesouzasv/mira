import { readStudy, saveStudy } from './storage.mjs';

export function studyCoordinator(storage, locks) {
  let owner;
  return {
    get owner() { return owner; },

    transact(change, onUpdate = () => {}) {
      function run() {
        const next = readStudy(storage);
        if (change(next)) saveStudy(storage, next);
        onUpdate(next);
      }
      return locks ? locks.request('mira.study-write', run) : Promise.resolve().then(run);
    },

    async claim(action, canClaim = () => true) {
      if (!locks) return;
      return locks.request('mira.timer-owner', { ifAvailable: true }, async lock => {
        if (!lock || !canClaim()) return;
        let release;
        const lifetime = new Promise(resolve => { release = resolve; });
        const token = { lifetime, release };
        owner = token;
        try {
          return await action(token);
        } finally {
          owner = undefined;
        }
      });
    },

    release(token = owner) {
      if (token && token === owner) {
        owner = undefined;
        token.release();
      }
    },
  };
}
