(function() {
  try {
    var validThemes = [
      'default',
      'amoled',
      'forest',
      'rose',
      'midnight',
      'ocean',
      'grape',
      'sunset',
      'cyber'
    ];
    var stored = localStorage.getItem('kloak-ui');
    var parsed = stored ? JSON.parse(stored) : null;
    var theme = parsed && parsed.state && parsed.state.theme;
    var safeTheme = validThemes.indexOf(theme) >= 0 ? theme : 'amoled';

    document.documentElement.className = safeTheme;
    document.documentElement.setAttribute('data-theme', safeTheme);
    document.documentElement.classList.remove('custom-theme');
    document.documentElement.removeAttribute('data-custom-theme');
  } catch (e) {
    document.documentElement.className = 'amoled';
    document.documentElement.setAttribute('data-theme', 'amoled');
    document.documentElement.classList.remove('custom-theme');
    document.documentElement.removeAttribute('data-custom-theme');
  }
})();
