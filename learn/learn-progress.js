// Learn completion marks. Set only by Mark complete / Clear completion.
// Last opened lab lesson: payePractice.learn.lastLesson ("1"…"6").
(function () {
    'use strict';

    var LAST_KEY = 'payePractice.learn.lastLesson';

    function key(n) {
        return 'payePractice.learn.lesson' + n + '.done';
    }

    function isLessonNumber(n) {
        return n === '1' || n === '2' || n === '3' || n === '4' || n === '5' || n === '6';
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

    function readLast() {
        try {
            var saved = localStorage.getItem(LAST_KEY);
            return isLessonNumber(saved) ? saved : '';
        } catch (e) {
            return '';
        }
    }

    function writeLast(n) {
        var value = isLessonNumber(n) ? n : '1';
        try {
            localStorage.setItem(LAST_KEY, value);
        } catch (e) {}
        return value;
    }

    function pageLocation() {
        try {
            if (typeof window === 'undefined' || !window.location) return null;
            return window.location;
        } catch (e) {
            return null;
        }
    }

    function lessonFromSearch(search) {
        try {
            return new URLSearchParams(search || '').get('lesson') || '';
        } catch (e) {
            return '';
        }
    }

    function resolveLesson(search) {
        var requested = lessonFromSearch(search);
        if (requested) return isLessonNumber(requested) ? requested : '1';
        return readLast() || '1';
    }

    function isCatalogue(path) {
        return path === '/learn/' || path === '/learn/index.html';
    }

    function isLab(path) {
        return path === '/learn/lab/' || path === '/learn/lab/index.html';
    }

    function escapeFrame(url) {
        try {
            if (window.top && window.top !== window && window.top.location) {
                window.top.location.href = url;
                return true;
            }
        } catch (e) {}
        return false;
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

    function rememberOpened(n) {
        var loc = pageLocation();
        if (!loc || !isLab(loc.pathname || '')) return;
        writeLast(n);
        if ((loc.search || '') === '?lesson=' + n) return;
        try {
            if (window.history && typeof window.history.replaceState === 'function') {
                window.history.replaceState({ lesson: n }, '', (loc.pathname || '') + '?lesson=' + n);
            }
        } catch (e) {}
    }

    document.addEventListener('click', function (e) {
        var lessonBtn = e.target.closest ? e.target.closest('.lab-lessons button[data-lesson]') : null;
        if (lessonBtn) {
            var picked = lessonBtn.getAttribute('data-lesson');
            if (isLessonNumber(picked)) writeLast(picked);
        }
        var clearAll = e.target.closest ? e.target.closest('[data-learn-clear-all]') : null;
        if (clearAll) {
            for (var lesson = 1; lesson <= 6; lesson++) setDone(String(lesson), false);
            paint();
            return;
        }
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
    window.addEventListener('popstate', function () {
        var loc = pageLocation();
        if (!loc || !isLab(loc.pathname || '')) return;
        rememberOpened(resolveLesson(loc.search || ''));
    });

    var loc = pageLocation();
    if (loc && isCatalogue(loc.pathname || '')) {
        var catalogueLesson = resolveLesson(loc.search || '');
        var catalogueUrl = '/learn/lab/?lesson=' + catalogueLesson;
        if (!escapeFrame(catalogueUrl) && typeof loc.replace === 'function') loc.replace(catalogueUrl);
    } else if (loc && isLab(loc.pathname || '')) {
        var opened = resolveLesson(loc.search || '');
        if (!escapeFrame((loc.pathname || '/learn/lab/') + '?lesson=' + opened)) rememberOpened(opened);
    }
})();
