const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID;
const GITHUB_WORKFLOW = process.env.GITHUB_WORKFLOW;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_REPOTEAM = GITHUB_REPOSITORY.split('/')[0];
const GITHUB_REPONAME = GITHUB_REPOSITORY.split('/')[1];
const REPO = { owner: GITHUB_REPOTEAM, repo: GITHUB_REPONAME };

let VNOW = false;
let VTAG = false;
let VNEXT = false;
let VLAST = false;
let VDATE = new Date().toISOString().substr(0, 10);
let VDIFF = -9;

//

const fs = require('fs');
const _ = require('lodash');
const pino = require('pino');
const execa = require('execa');
const chalk = require('chalk');
const semver = require('semver');

//const core = require('@actions/core');
//const github = require('@actions/github');
const { Octokit } = require("@octokit/rest");

//

const octokit = new Octokit({ auth: GITHUB_TOKEN });

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

    // Object.keys(process.env).sort().forEach(x => { if (x.startsWith('GITHUB')) { LOG.TRACE(x + ': ' + process.env[x]); } });

    let repoinfofile = process.cwd() + '/package.json';
    if (!fs.existsSync(repoinfofile)) { LOG.WARN('MISSING PACKAGE.JSON'); fs.writeFileSync(repoinfofile, '{"version":"0.0.0"}' + "\n"); }

    let repoinfo = require(repoinfofile);
    if (!repoinfo.version) { LOG.WARN('MISSING REPOINFO.VERSION'); repoinfo.version = '0.0.0'; }

    //let nextv = core.getInput('NEXTVERSION').toLowerCase() || 'patch';
    let nextv = process.env.NEXTVERSION || 'patch'; nextv = nextv.toLowerCase();
    LOG.INFO('NEXTVERSION: ' + nextv);

    if (nextv == 'patch' || nextv == 'minor' || nextv == 'major') {
        VNOW = repoinfo.version;
        VTAG = VNOW.includes('-') ? semver.inc(VNOW, nextv) : VNOW;
        VNEXT = semver.inc(VTAG, nextv) + '-dev';
        VLAST = repoinfo.versiontaglast;
    }
    else {
        VNOW = repoinfo.version;
        VTAG = VNOW.includes('-') ? VNOW.split('-')[0] : VNOW;
        VNEXT = nextv + '-dev';
        VLAST = repoinfo.versiontaglast;
    }

    repoinfo.versiontaglast = VTAG;
    fs.writeFileSync(process.cwd() + '/package.json', JSON.stringify(repoinfo));

    //try { VDIFF = execa.commandSync('git rev-list HEAD ^' + VLAST + ' --count').stdout - 1; } catch (ex) { }
    try {
        let diffcmd = execa.commandSync('git rev-list HEAD ^' + VLAST + ' --count');
        LOG.TRACE('DiffCount: ' + diffcmd.stdout);
        VDIFF = diffcmd.stdout - 1;
    } catch (ex) { LOG.ERROR(ex); }

    LOG.INFO('Version.LAST: ' + VLAST);
    LOG.INFO('Version.NOW:  ' + VNOW);
    LOG.INFO('Version.TAG:  ' + VTAG);
    LOG.INFO('Version.NEXT: ' + VNEXT);
    LOG.INFO('Version.DIFF: ' + VDIFF);

    LOG.DEBUG('App.InitDone');
    await App.Main();
}

App.Main = async function () {
    LOG.DEBUG('App.Main');

    await App.FX();
    await App.CMD();

    await App.DeletePastRuns(GITHUB_WORKFLOW);
}

//

App.GetProject = async function (repo) {
    let p = false;
    let pz = await octokit.rest.projects.listForRepo(repo); //console.log(pz);    
    if (pz.data.length == 0) { return false; }
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
    return colz;
}

App.GetCard = async function (inum) {
    let issue_ = await octokit.rest.issues.get({ owner: GITHUB_REPOTEAM, repo: GITHUB_REPONAME, issue_number: inum });
    let issue = issue_.data; //console.log(issue);

    //let labels = await octokit.rest.issues.listLabelsOnIssue({ owner: GITHUB_REPOTEAM, repo: GITHUB_REPONAME, issue_number: inum }); //console.log(labels.data);

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
        let x = gitcards.data[i];
        let card = { Number: 0, Note: x.note, Issue: 'INFO' };
        if (x.content_url) {
            let inum = parseInt(x.content_url.split('/').pop());
            card = await App.GetCard(inum);
        }
        cardlist.push(card);
    }

    return cardlist;
}

App.GetCardList = async function () {
    let cardlist = false;

    let p = await App.GetProject(REPO);
    if (!p) { LOG.ERROR('App.GetProject: FAILED'); return false; }

    let colz = await App.GetColumns(p);
    if (!colz) { LOG.ERROR('App.GetColumns: FAILED'); }
    if (!colz['DONE']) { LOG.WARN('App.GetColumns: MISSING_COLUMN = DONE'); return false; }

    cardlist = await App.GetCards(colz['DONE']);
    if (!cardlist) { LOG.ERROR('App.GetCards: FAILED'); return false; }

    //LOG.TRACE('App.Cards', cardlist);
    return cardlist;
}

//

App.FX = async function () {
    let msgz = {};
    let items = [];
    let itemdb = {};

    let cardlist = await App.GetCardList();
    if (cardlist) {
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

        items.forEach(x => {
            if (!itemdb[x.Issue]) { itemdb[x.Issue] = []; }
            itemdb[x.Issue].push(x);
        });
    }

    LOG.INFO('App.GetLogTXT' + "\n" + App.GetLogTXT(itemdb));

    fs.writeFileSync('/tmp/changenow.md', App.GetLogMD(itemdb));

}

//

App.GetLogTXT = function (itemdb) {
    let txt = [];
    txt.push('# ' + VTAG + ' @ ' + VDATE); txt.push(null);
    txt.push('## DIFF');
    txt.push('- ' + (VDIFF >= 0 ? VDIFF : '?') + ' COMMITS SINCE LAST TAG' + (VLAST ? ' = ' + VLAST : ''));
    Object.keys(itemdb).forEach(k => {
        txt.push('## ' + k); // txt.push(null);
        itemdb[k].forEach(z => {
            let line = '- ';
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
    txt.push('# [' + VTAG + ' @ ' + VDATE + '](https://github.com/' + GITHUB_REPOTEAM + '/' + GITHUB_REPONAME + '/releases/tag/' + VTAG + ')');
    txt.push('## DIFF');
    txt.push('- [' + (VDIFF >= 0 ? VDIFF : '?') + ' COMMITS SINCE LAST TAG' + (VLAST ? ' = ' + VLAST : '') + '](https://github.com/cogsmith/test-actions/compare/' + (VLAST ? VLAST : '0.0.0') + '...' + VTAG + ')');
    let keyi = 0; Object.keys(itemdb).forEach(k => {
        if (keyi++ > -1) { txt.push(null); txt.push('---'); txt.push(null); }
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

App.RunCMDS = function (cmds) {
    for (let i = 0; i < cmds.length; i++) {
        let cmd = cmds[i];
        let msg = 'App.CMD: ' + cmd;
        let run = false; try { run = execa.commandSync(cmd, { shell: true }); } catch (ex) { LOG.ERROR(ex); }
        if (!run) { continue; }
        if (run.stdout.trim().length > 0) {
            if (run.stdout.includes("\n")) { msg += "\n" + chalk.gray(run.stdout); }
            else { msg += chalk.gray(' => ') + chalk.white(run.stdout); }
        }
        LOG.DEBUG(msg);
    }
}

App.CMD = async function () {
    let cmdz = false;

    //cmdz = [];
    //cmdz.push('date >> DT.TXT');
    //App.RunCMDS(cmdz);

    cmdz = [];
    cmdz.push('git config user.name DEVKING ; git config user.email devkingbot@cogsmith.com');
    App.RunCMDS(cmdz);

    /*
    cmdz = [];
    cmdz.push("git commit --allow-empty -m 'END " + VNOW + "'");
    cmdz.push('git push');
    App.RunCMDS(cmdz);
    */

    cmdz = [];
    cmdz.push('npm version ' + VTAG + ' --no-git-tag-version --allow-same-version');
    cmdz.push('echo > /tmp/newline ; cat /tmp/changenow.md /tmp/newline CHANGELOG.md >> /tmp/changelog.md ; mv /tmp/changelog.md CHANGELOG.md');
    cmdz.push('git add .');
    cmdz.push("git commit -m 'TAG " + VTAG + "'");
    cmdz.push('git push');
    App.RunCMDS(cmdz);

    /*
    cmdz = [];
    cmdz.push('git push --delete origin ' + VTAG + ' ; echo');
    cmdz.push('gh release delete ' + VTAG + ' --yes ; echo');
    App.RunCMDS(cmdz);
    */

    /*
    cmdz = [];
    cmdz.push("grep -v '# \\[' /tmp/changenow.md > /tmp/changenow-notitle.md ; echo");
    cmdz.push('gh release create ' + VTAG + ' --target main -F /tmp/changenow-notitle.md');
    App.RunCMDS(cmdz);
    */

    cmdz = [];
    cmdz.push('gh release create ' + VTAG + ' --target main -F /tmp/changenow.md');
    App.RunCMDS(cmdz);

    cmdz = [];
    cmdz.push('npm version ' + VNEXT + ' --no-git-tag-version');
    cmdz.push('git add .');
    cmdz.push("git commit -m 'DEV " + VNEXT + "'");
    cmdz.push('git push');
    App.RunCMDS(cmdz);
}

//

App.DeletePastRuns = async function (workflow) {
    let runs = await octokit.rest.actions.listWorkflowRunsForRepo({ owner: REPO.owner, repo: REPO.repo, per_page: 100 });
    for (let i = 0; i < runs.data.workflow_runs.length; i++) {
        let run = runs.data.workflow_runs[i];
        if ((GITHUB_RUN_ID == run.id) || (workflow && run.name != workflow)) { continue; }
        LOG.INFO('DeleteRun: ' + run.id);
        try { await octokit.rest.actions.deleteWorkflowRun({ owner: REPO.owner, repo: REPO.repo, run_id: run.id }); } catch (ex) { LOG.ERROR(ex); }
    }
}

//

App.Init();