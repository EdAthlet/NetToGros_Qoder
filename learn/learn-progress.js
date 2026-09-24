// Learn completion marks. Set only by Mark complete / Clear completion.
(function () {
    'use strict';

    function key(n) {
        return 'payePractice.learn.lesson' + n + '.done';
    }

    function isDone(n) {
        try {
            return localStorage.getItem(key(n)) === '1';
        } catch (e) {
            return false;
        }
    }

    function setDone(n, done) {
        try {
            if (done) localStorage.setItem(key(n), '1');
            else localStorage.removeItem(key(n));
        } catch (e) {}
    }

    function paint() {
        var nodes = document.querySelectorAll('[data-learn-lesson]');
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i].getAttribute('data-learn-lesson');
            var done = isDone(n);
            nodes[i].classList.toggle('is-completed', done);
            var marks = nodes[i].querySelectorAll('[data-learn-status]');
            for (var j = 0; j < marks.length; j++) {
                if (done) marks[j].removeAttribute('hidden');
                else marks[j].setAttribute('hidden', '');
            }
        }
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-learn-complete], [data-learn-clear]') : null;
        if (!btn) return;
        var n = btn.getAttribute('data-learn-complete') || btn.getAttribute('data-learn-clear');
        if (!n) return;
        setDone(n, btn.hasAttribute('data-learn-complete'));
        paint();
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint);
    else paint();

    window.addEventListener('storage', paint);
})();
