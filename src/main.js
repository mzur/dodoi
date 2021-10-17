import Vue from 'vue';
import sha1 from 'js-sha1';
import {toJSON, toBibtex} from "@orcid/bibtex-parse-js";

// Inspired by doi2bib:
// https://github.com/davidagraf/doi2bib2/blob/7a5159a9465538c4b4f313c26046fa9e7a9d24cc/client/src/utils/Bib.js

const SPECIAL_CHARS = {
   'à': '\\`a',
   'ô': '\\^o',
   'ê': '\\^e',
   'â': '\\^a',
   '®': '{\\textregistered}',
   'ç': '\\c{c}',
   'ö': '\\"{o}',
   'ä': '\\"{a}',
   'ü': '\\"{u}',
   'Ö': '\\"{O}',
   'Ä': '\\"{A}',
   'Ü': '\\"{U}',
};

// Times between subsequent request retry attempts.
const RETRY_TIMES = [
   1e+3,
   5e+3,
   1e+4,
];

new Vue({
   el: '#app',
   data() {
      return {
         doi: '',
         bibtex: '',
         copiedToClipboard: false,
         loading: false,
         error: false,
         errorMessage: '',
         retryCount: 0,
      };
   },
   computed: {
      ctcButtonClass() {
         return this.copiedToClipboard ? 'bg-blue-600' : 'bg-gray-200 hover:bg-gray-300 focus:bg-gray-400';
      },
      ctcIconClass() {
         return this.copiedToClipboard ? 'text-white' : 'text-blue-600';
      },
      cantSubmit() {
         return !this.doi || this.loading;
      },
      inputClass() {
         if (this.error) {
            return 'outline-none ring-4 ring-red-600 border-transparent';
         }

         return 'focus:outline-none focus:ring-4 focus:ring-blue-400 focus:border-transparent';
      },
   },
   methods: {
      reset() {
         this.bibtex = '';
         this.copiedToClipboard = false;
         this.error = false;
         this.errorMessage = '';
      },
      handleSubmit() {
         this.reset();
         if (!/^10\..+\/.+$/.test(this.doi)) {
            this.handleError('Invalid DOI.');
            return;
         }

         this.loading = true;

         const request = this.getRequest(this.doi);

         fetch(request)
           .then(this.parseResponse)
           .then(this.cleanBibtex)
           .then(this.finishRequest)
           .catch(this.handleResponseError)
           .finally(this.finishLoading);
      },
      getRequest(doi) {
         const headers = new Headers();
         headers.append('Accept', 'application/x-bibtex; charset=utf-8');

         return new Request(`https://doi.org/${doi}`, {
            method: 'GET',
            headers: headers,
         });
      },
      parseResponse(response) {
         if (!response.ok) {
            return Promise.reject(response);
         }

         const contentType = response.headers.get('content-type');
         if (!contentType || !contentType.includes('application/x-bibtex')) {
            throw new TypeError("Invalid response content type.");
         }

         return response.text();
      },
      cleanBibtex(bibtex) {
         let bibJson = toJSON(bibtex)[0];
         let tags = bibJson.entryTags;

         if (tags.pages) {
            if (tags.pages === 'n/a-n/a') {
               delete tags.pages;
            } else if (tags.pages.indexOf('--') === -1) {
               tags.pages = tags.pages.replace(/-/g, '--');
            }
         }

         if (bibJson.citationKey) {
            bibJson.citationKey = bibJson.citationKey.replace(/_/g, '');
         }

         if (tags.url) {
            tags.url = decodeURIComponent(tags.url);
         }

         if (tags.title) {
            if (Array.isArray(tags.title)) {
               tags.title = tags.title.map(this.insertDollars)
            } else {
               // Inject $ into titles where greek characters aren't formatted properly.
               // E.g. 10.1002/cncr.29046 {\varEpsilon} instead of {$\varEpsilon$}.
               tags.title = this.insertDollars(tags.title);
            }

            // Add a unique suffix to the key (based on the title).
            if (bibJson.citationKey) {
               let digest = sha1(tags.author + tags.title);
               bibJson.citationKey += '-' + digest.substr(0, 7);
            }
         }

         for (let key in tags) {
            tags[key] = this.encodeSpecialChars(tags[key]);
         }

         return toBibtex([bibJson], false)
            .trim()
            // Use two spaces instead of the default four for indentation.
            .replace(/^  /gm, '');
      },
      insertDollars(str) {
         return str.replace(/(\{)(\\var[A-Z]?[a-z]*)(\})/, '$1$$$2$$$3')
      },
      encodeSpecialChars(str) {
         const regex = new RegExp(Object.keys(SPECIAL_CHARS).join('|'), 'gi');

         return str.replace(regex, m => SPECIAL_CHARS[m]);
      },
      copyToClipboard() {
         if (this.bibtex) {
            navigator.clipboard.writeText(this.bibtex).then(this.ctcSuccess);
         }
      },
      ctcSuccess() {
         this.copiedToClipboard = true;
      },
      handleError(message) {
         this.error = true;
         this.errorMessage = message;
      },
      handleResponseError(response) {
         if (response instanceof Error) {
            this.handleError(response.message);
         } else if (response.status === 504 && this.retryCount < RETRY_TIMES.length) {
            // Retry a few times on gateway timeouts. These seem to occur quite often.
            setTimeout(this.handleSubmit, RETRY_TIMES[this.retryCount]);
            this.retryCount += 1;
            return;
         } else if (response.status >= 400) {
            this.handleError(response.statusText);
         } else {
            this.handleError('Unknown error.');
         }

         this.retryCount = 0;
      },
      finishRequest(bibtex) {
         this.bibtex = bibtex;
         this.retryCount = 0;
      },
      finishLoading() {
         // Keep loading if we are waiting on a request retry.
         if (this.retryCount === 0) {
            this.loading = false;
         }
      },
   },
});
