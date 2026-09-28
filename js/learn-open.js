(function () {
  'use strict';

  function lessonNumber() {
    try {
      var saved = localStorage.getItem('payePractice.learn.lastLesson');
      if (saved === '1' || saved === '2' || saved === '3' || saved === '4' || saved === '5' || saved === '6') return saved;
    } catch (e) {}
    return '1';
  }

  function pointLearnLinks() {
    var href = '/learn/lab/?lesson=' + lessonNumber();
    var links = document.querySelectorAll('a[target="_top"]');
    for (var i = 0; i < links.length; i++) {
      var text = (links[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (text !== 'Learn the Project') continue;
      links[i].setAttribute('href', href);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pointLearnLinks);
  else pointLearnLinks();
})();
