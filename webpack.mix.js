const mix = require('laravel-mix');

mix.disableSuccessNotifications();

mix.js('src/main.js', 'assets').vue();

mix.postCss('src/main.css', 'assets');

mix.webpackConfig({
  stats: {
    children: true,
  },
});
