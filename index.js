const color = require('color');
const { execFile } = require('child_process');

let configuration = {
    gcloudBinary: 'gcloud',
    kubectlBinary: 'kubectl'
};

let state = {
    gcp: 'n/a',
    gce: 'n/a',
    kubernetes: 'n/a'
}

function setGcpProject() {
    runCommand(configuration.gcloudBinary, ['config', 'get-value', 'project']).then(project => {
        state.gcp = project;
    }).catch(() => {
        state.gcp = 'n/a';
    })
}

function setGceDefaultZone() {
    runCommand(configuration.gcloudBinary, ['config', 'get-value', 'compute/zone']).then(zone => {
        state.gce = zone;
    }).catch(() => {
        state.gce = 'n/a';
    })
}

function setKubernetesContext() {
    runCommand(configuration.kubectlBinary, ['config', 'current-context']).then(context => {
        runCommand(configuration.kubectlBinary, ['config', 'view', '--minify', '--output', 'jsonpath={..namespace}']).then(namespace => {
            state.kubernetes = context + " (" + namespace + ")";
        }).catch(() => {
            state.kubernetes = context + " (default)";
        })
    }).catch(() => {
        state.kubernetes = 'n/a';
    })
}

function runCommand(command, options) {
    return new Promise((resolve, reject) => {
        execFile(command, options, (error, stdout, stderr) => {
            if (error) {
                reject(`${error}\n${stderr}`)
            }
            if (stdout.trim() == "") {
                reject("stdout was empty");
            }
            resolve(stdout.trim())
        })
    })
}

exports.reduceUI = (state, { type, config }) => {
    switch (type) {
        case 'CONFIG_LOAD':
        case 'CONFIG_RELOAD': {
            configuration = Object.assign(configuration, config.hyperGcpStatusLine);
        }
    }

    return state
}

exports.decorateConfig = (config) => {
    const colorForeground = color(config.foregroundColor || '#fff');
    const colorBackground = color(config.backgroundColor || '#000');
    const colors = {
        foreground: colorForeground.string(),
        background: colorBackground.lighten(0.3).string()
    };

    return Object.assign({}, config, {
        css: `
            ${config.css || ''}
            .terms_terms {
                margin-bottom: 30px;
            }
            .hyper-gcp-status-line {
                display: flex;
                justify-content: flex-start;
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                z-index: 100;
                font-size: 12px;
                height: 30px;
                padding: 5px 0 0 10px;
                color: ${colors.foreground};
                background-color: ${colors.background};
            }
            .hyper-gcp-status-line .item {
                padding: 2px 15px 0 25px;
            }
            .hyper-gcp-status-line .gcp {
                background: url(${__dirname}/icons/gcp.svg) no-repeat;
            }
            .hyper-gcp-status-line .gce {
                background: url(${__dirname}/icons/gce.svg) no-repeat;
            }
            .hyper-gcp-status-line .kubernetes {
                background: url(${__dirname}/icons/kubernetes.svg) no-repeat;
            }
        `
    })
}

exports.decorateHyper = (Hyper, { React }) => {
    return class extends React.PureComponent {
        constructor(props) {
            super(props);
            this.state = {};
        }

        render() {
            const { customChildren } = this.props
            const existingChildren = customChildren ? customChildren instanceof Array ? customChildren : [customChildren] : [];

            return (
                React.createElement(Hyper, Object.assign({}, this.props, {
                    customInnerChildren: existingChildren.concat(React.createElement('footer', { className: 'hyper-gcp-status-line' },
                        React.createElement('div', { className: 'item gcp', title: 'GCP project' }, this.state.gcp),
                        React.createElement('div', { className: 'item gce', title: 'Compute Engine default zone' }, this.state.gce),
                        React.createElement('div', { className: 'item kubernetes', title: 'Kubernetes context and namespace' }, this.state.kubernetes)
                    ))
                }))
            );
        }

        componentDidMount() {
            this.interval = setInterval(() => {
                this.setState(state);
            }, 100);
        }

        componentWillUnmount() {
            clearInterval(this.interval);
        }
    };
}

exports.middleware = (store) => (next) => (action) => {
    switch (action.type) {
        case 'SESSION_ADD_DATA':
            const { data } = action;
            if (data.indexOf('\n') > 1) {
                setGcpProject();
                setGceDefaultZone();
                setKubernetesContext();
            }
            break;

        case 'SESSION_SET_ACTIVE':
            setGcpProject();
            setGceDefaultZone();
            setKubernetesContext();
            break;
    }

    next(action);
}