const path = require("path");
const glob = require("glob");
const po2json = require('po2json');
const Jed = require('jed');

module.exports = class {
    apply(compiler) {
        compiler.hooks.emit.tapPromise(
            'CockpitPoPlugin',
            compilation => Promise.all(glob.sync('po/*.po').map(f => this.buildFile(f, compilation)))
        );
    }

    prepareHeader(header) {
        if (!header)
            return null;

        var body, statement, ret = null;
        const plurals = header["plural-forms"];

        if (plurals) {
            try {
                /* Check that the plural forms isn't being sneaky since we build a function here */
                Jed.PF.parse(plurals);
            } catch(ex) {
                fatal("bad plural forms: " + ex.message, 1);
            }

            /* A function for the front end */
            statement = header["plural-forms"];
            if (statement[statement.length - 1] != ';')
                statement += ';';
            ret = 'function(n) {\nvar nplurals, plural;\n' + statement + '\nreturn plural;\n}';

            /* Added back in later */
            delete header["plural-forms"];
        }

        /* We don't need to be transferring this */
        delete header["project-id-version"];
        delete header["report-msgid-bugs-to"];
        delete header["pot-creation-date"];
        delete header["po-revision-date"];
        delete header["last-translator"];
        delete header["language-team"];
        delete header["mime-version"];
        delete header["content-type"];
        delete header["content-transfer-encoding"];

        return ret;
    }

    buildFile(po_file, compilation) {
        return new Promise((resolve, reject) => {
            const jsonData = po2json.parseFileSync(po_file);
            const plurals = this.prepareHeader(jsonData[""]);

            let output = JSON.stringify(jsonData, null, 1);

            // We know the brace in is the location to insert our function
            if (plurals) {
                const pos = output.indexOf('{', 1);
                output = output.substr(0, pos + 1) + "'plural-forms':" + String(plurals) + "," + output.substr(pos + 1);
            }

            // wrap JSON output into cockpit.locale() call
            output = 'cockpit.locale(' + output + ');\n';

            const lang = path.basename(po_file).slice(0, -3)
            compilation.assets['po.' + lang + '.js'] = { source: () => output, size: () => output.length };
            resolve();
        });
    };
};
