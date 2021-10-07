import Vue from 'vue';
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

new Vue({
   el: '#app',
   data() {
      return {
         doi: '',
         bibtex: '',
      };
   },
   methods: {
      handleSubmit() {
         if (!/^10\..+\/.+$/.test(this.doi)) {
            console.error("Invalid DOI");
            return;
         }

         const request = this.getRequest(this.doi);

         fetch(request)
           .then(this.parseResponse)
           .then(this.cleanBibtex)
           .then(bibtex => this.bibtex = bibtex);
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
         const contentType = response.headers.get('content-type');
         if (!contentType || !contentType.includes('application/x-bibtex')) {
            throw new TypeError("The response was no BibTeX!");
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
               tags.title = this.insertDollars(tags.title);
            }

            if (bibJson.citationKey) {
               bibJson.citationKey += tags.title.split(' ')[0];
            }
         }

         for (let key in tags) {
            tags[key] = this.encodeSpecialChars(tags[key]);
         }

         return toBibtex([bibJson], false);
      },
      insertDollars(str) {
         return str.replace(/(\{)(\\var[A-Z]?[a-z]*)(\})/, '$1$$$2$$$3')
      },
      encodeSpecialChars(str) {
         const regex = new RegExp(Object.keys(SPECIAL_CHARS).join('|'), 'gi');

         return str.replace(regex, m => SPECIAL_CHARS[m]);
      },
   },
});