const mix = require('laravel-mix');

mix.disableSuccessNotifications();

mix.js('src/main.js', 'assets').vue();

// mix.sass('resources/assets/sass/main.scss', 'public/assets/styles');
