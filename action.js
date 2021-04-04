const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_REPONAME = GITHUB_REPOSITORY.split('/')[1];
const GITHUB_REPOTEAM = GITHUB_REPOSITORY.split('/')[0];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = { owner: GITHUB_REPOTEAM, repo: GITHUB_REPONAME };

//

const fs = require('fs');

const _ = require('lodash');
const pino = require('pino');
const execa = require('execa');
const chalk = require('chalk');
const semver = require('semver');

const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: GITHUB_TOKEN });


//

/*

console.log(semver.inc('0.0.0-dev', 'patch'));

// process.exit();

console.log(chalk.red('___REDALERT___'));
console.log('ACTION');
console.log('0.1.1');
console.log();

Object.keys(process.env).sort().forEach(x => { if (x.startsWith('GITHUB')) { console.log(x + ' = ' + process.env[x]); } });
console.log();

const AppPackageFile = process.cwd() + '/package.json';
const AppPackage = require(AppPackageFile);

console.log(AppPackage);

if (!AppPackage.version) { AppPackage.version = '0.0.0'; }

let vz = [AppPackage.version.split('-')[1]].concat(AppPackage.version.split('-')[0].split('.'));

let bumplevel = 'PATCH';

if (bumplevel == 'PATCH') { vz[3]++; }

AppPackage.version = vz.slice(1).join('.');

//if (vz[0]) { AppPackage.version += '-' + vz[0]; };

console.log(AppPackage);
console.log();

fs.writeFileSync(AppPackageFile, JSON.stringify(AppPackage));

// Compare: https://docs.github.com/en/rest/reference/repos/#list-organization-repositories
octokit.rest.repos.listForOrg({ org: "octokit", type: "public", }).then(({ data }) => {
    //console.log(data);
});

*/

//

const App = {};

App.Args = { loglevel: 'trace', logfancy: true };

App.LogFancy = false; if (App.Args.logfancy) { App.LogFancy = { colorize: true, singleLine: true, translateTime: 'SYS:yyyy-mm-dd|HH:MM:ss', ignore: 'hostname,pid', messageFormat: function (log, key, label) { let msg = log.msg ? log.msg : ''; let logout = chalk.gray(App.Meta.NameTag); if (msg != '') { logout += ' ' + msg }; return logout; } }; }
App.Log = pino({ level: App.Args.loglevel, hooks: { logMethod: function (args, method) { if (args.length === 2) { args.reverse() } method.apply(this, args) } }, prettyPrint: App.LogFancy });
const LOG = App.Log; LOG.TRACE = LOG.trace; LOG.DEBUG = LOG.debug; LOG.INFO = LOG.info; LOG.WARN = LOG.warn; LOG.ERROR = LOG.error; LOG.FATAL = LOG.fatal;

const AppPackage = require('./package.json');
const AppMeta = _.merge(AppPackage, { Version: AppPackage.version || process.env.npm_package_version || '0.0.0', Name: AppPackage.namelong || AppPackage.name || 'App', NameTag: AppPackage.nametag || AppPackage.name.toUpperCase(), Info: AppPackage.description || '' });
AppMeta.Full = AppMeta.Name + ': ' + AppMeta.Info + ' [' + AppMeta.Version + ']';
App.Meta = AppMeta;

App.InfoDB = {}; App.Info = function (id) { let z = App.InfoDB[id]; if (!z) { return z; } else { return z.Type == 'FX' ? z.Value() : z.Value; } };
App.SetInfo = function (id, value) { if (typeof (value) == 'function') { return App.InfoDB[id] = { Type: 'FX', Value: value } } else { return App.InfoDB[id] = { Type: 'VALUE', Value: value } } };
App.SetInfo('Node.Args', process.argv.join(' '));
App.SetInfo('Node', require('os').hostname().toUpperCase() + ' : ' + process.pid + '/' + process.ppid + ' : ' + process.cwd() + ' : ' + process.version + ' : ' + require('os').version() + ' : ' + process.title);
App.SetInfo('App', App.Meta.Full);


//

App.Init = async function () {
    LOG.TRACE({ App: App });
    LOG.INFO(App.Meta.Full);
    LOG.DEBUG('Node.Info: ' + chalk.white(App.Info('Node')));
    LOG.DEBUG('Node.Args: ' + chalk.white(App.Info('Node.Args')));

    LOG.DEBUG('App.Init');

    Object.keys(process.env).sort().forEach(x => { if (x.startsWith('GITHUB')) { LOG.TRACE(x + ': ' + process.env[x]); } });

    LOG.DEBUG('App.InitDone');
    await App.Main();
}

App.Main = async function () {
    LOG.DEBUG('App.Main');
    await App.FX();
    setTimeout(App.CMD, 9);
}

//

App.GetProject = async function (repo) {
    //LOG.INFO('App.GetProject: ' + JSON.stringify(repo));
    let p = false;
    let pz = await octokit.rest.projects.listForRepo(repo); //console.log(pz);
    p = pz.data.find(z => z.number === 1);
    LOG.DEBUG('App.GetProject: ' + JSON.stringify(repo), { ID: p.id });
    return p;
}

App.GetColumns = async function (p) {
    LOG.DEBUG('App.GetColumns: ' + p.id); //console.log(p);
    let colz = {};
    let cz = await octokit.rest.projects.listColumns({ project_id: p.id }); //console.log(cz);
    cz.data.forEach(x => {
        colz[x.id] = x;
        colz[x.name] = x;
    });
    //console.log({ COLZ: colz });
    return colz;
}

App.GetCard = async function (inum) {
    //LOG.INFO('App.GetCard: ' + inum);
    let issue_ = await octokit.rest.issues.get({ owner: GITHUB_REPOTEAM, repo: GITHUB_REPONAME, issue_number: inum });
    let issue = issue_.data;
    //console.log(issue);

    //let labels = await octokit.rest.issues.listLabelsOnIssue({ owner: GITHUB_REPOTEAM, repo: GITHUB_REPONAME, issue_number: inum });
    //console.log(labels.data);

    // let card = { Number: 0, Note: null, Issue: 'INFO' };

    let labels = []; if (issue.labels) { issue.labels.forEach(z => { labels.push(z.name) }); }
    let card = { Number: inum, Note: issue.title, State: issue.state.toUpperCase(), Labels: labels };
    labels.forEach(z => {
        if (z.startsWith('ISSUE_')) { card.Issue = z.split('_')[1]; }
        if (z.startsWith('TOPIC_')) { card.Topic = z.split('_')[1]; }
        if (z.startsWith('STATUS_')) { card.Status = z.split('_')[1]; }
    });

    if (!card.Number) { card.Issue = 'INFO'; }
    if (!card.Issue) { card.Issue = 'ISSUE'; }
    if (!card.Topic) { card.Topic = null; }

    LOG.DEBUG('App.GetCard: ' + inum, card);
    return card;
}

App.GetCards = async function (col) {
    LOG.DEBUG('App.GetCards: ' + col.id + ' = ' + col.name);
    let cardlist = [];
    let gitcards = await octokit.rest.projects.listCards({ column_id: col.id }); // console.log(gitcards);

    for (let i = 0; i < gitcards.data.length; i++) {
        let gitcard = gitcards.data[i]; let x = gitcard;

        let card = { Number: 0, Note: x.note, Issue: 'INFO' };
        if (x.content_url) {
            let inum = parseInt(x.content_url.split('/').pop());
            card = await App.GetCard(inum);
        }
        cardlist.push(card);
    }

    return cardlist;
}

//

App.FX = async function () {
    let p = await App.GetProject(REPO);
    let colz = await App.GetColumns(p);
    let cardlist = await App.GetCards(colz['DONE']);

    LOG.TRACE('App.Cards', cardlist);

    let msgz = {};
    let items = [];

    cardlist.forEach(x => { if (x.Number == 0) { items.push(x); } });

    let issueorder = 'SECURITY BREAKING CHANGE BUG FEATURE DEV TASK HOWTO NOTES'.split(' ');
    issueorder.forEach(x => {
        let xlist = _.orderBy(cardlist, ['Topic', 'Number']).filter(z => z.Issue === x);
        if (xlist) { xlist.forEach(zz => { items.push(zz); }); }
    });

    _.orderBy(cardlist, ['Topic', 'Number']).forEach(x => {
        if (x.Number == 0) { return; }
        if (issueorder.concat('ISSUE').includes(x.Issue)) { return; }
        items.push(x);
    });

    let x = 'ISSUE'; let xlist = _.orderBy(cardlist, ['Topic', 'Number']).filter(z => z.Issue === x);
    if (xlist) { xlist.forEach(zz => { items.push(zz); }); }

    let itemdb = {};
    items.forEach(x => {
        if (!itemdb[x.Issue]) { itemdb[x.Issue] = []; }
        itemdb[x.Issue].push(x);
    });

    fs.writeFileSync('/tmp/changenow.md', App.GetLogMD(itemdb));

    LOG.INFO('App.GetLogTXT' + "\n" + App.GetLogTXT(itemdb));

    //console.log("\n\n");
    //console.log(itemdb);

    //console.log("\n\n");
    //console.log(items);

    //console.log("\n\n");
    //console.log(App.GetLogTXT(itemdb));

    //console.log("\n\n");
    //console.log(App.GetLogMD(itemdb));

    //console.log("\n\n");
    //console.log(msgz);

}

//

App.GetLogTXT = function (itemdb) {
    let txt = [];
    txt.push('# 0.0.0 @ 2099-12-31'); txt.push(null);
    Object.keys(itemdb).forEach(k => {
        txt.push('## ' + k); // txt.push(null);
        itemdb[k].forEach(z => {
            let line = '';
            if (z.Topic) { line += z.Topic + ': '; }
            if (z.Number != 0) { line += '#' + z.Number + ': '; }
            line += z.Note;
            txt.push(line);
        });
        txt.push(null);
    });
    return txt.join("\n").trim();
}

App.GetLogMD = function (itemdb) {
    let txt = [];
    txt.push('<code>'); txt.push(null);
    txt.push('# [0.0.0 @ 2099-12-31](https://github.com/' + GITHUB_REPOTEAM + '/' + GITHUB_REPONAME + '/releases/tag/' + '0.0.0' + ')');
    Object.keys(itemdb).forEach(k => {
        txt.push(null); txt.push('---'); txt.push(null);
        txt.push('## ' + k); // txt.push(null);
        itemdb[k].forEach(z => {
            let line = '- ';
            if (z.Number != 0) {
                if (z.Topic) { line += '<b>' + z.Topic + '</b>' + ': '; }
                line += '['; if (z.Number != 0) { line += '#' + z.Number + ': '; } line += z.Note; line += ']';
                line += '(' + 'https://github.com/' + GITHUB_REPOTEAM + '/' + GITHUB_REPONAME + '/issues/' + z.Number + ')';
            }
            else {
                if (z.Topic) { line += '<b>' + z.Topic + '</b>' + ': '; }
                line += z.Note;
            }
            txt.push(line);
        });
    });
    txt.push(null);
    txt.push('</code>');
    return txt.join("\n").trim();
}

//

App.CMD = async function () {
    let cmdz = [];

    cmdz.push('echo ; echo ___CMD___ ; echo');
    cmdz.push('date >> dt.txt');
    cmdz.push('npm version patch --no-git-tag-version ; npm version patch --no-git-tag-version');
    cmdz.push('git config user.name DEVKING ; git config user.email devkingbot@cogsmith.com');
    // cmdz.push('echo ' + GITHUB_TOKEN + ' | gh auth login --with-token');
    cmdz.push('gh release delete 9.9.9 --yes');
    cmdz.push('gh release create 9.9.9 --target main -F /tmp/changenow.md');
    cmdz.push('git add .');
    cmdz.push("git commit -m 'DT'");
    cmdz.push('git push');

    for (let i = 0; i < cmdz.length; i++) {
        let cmd = cmdz[i];
        let run = false;
        try { run = execa.commandSync(cmd, { shell: true }); } catch (ex) { }
        if (!run) { continue; }
        LOG.DEBUG('App.CMD: ' + cmd);// + "\n" + run.stdout);
        //LOG.INFO('App.CMD: ' + cmd + "\n" + run.stdout);
    }
}

//

App.Init();