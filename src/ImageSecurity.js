import React from 'react';
import cockpit from 'cockpit';
const _ = cockpit.gettext;

class ImageSecurity extends React.Component {
    constructor(props) {
	super(props);
    }
    render() {
	let info = this.props.info;
	let text, rows;
	let args = {
	    time: info.finishedTime.format('MMM Do'),
	    type: info.scanType,
	    count: info.vulnerabilities.length
	};

	// if (info.successful === false) {
	    // text = _("The scan from $time ($type) was not successful.");
	// } else if (info.vulnerabilities.length === 0) {
	    text = _("The scan from $time ($type) found no vulnerabilities.");
	// } else {
	    // text = cockpit.ngettext('The scan from $time ($type) found one vulnerability:',
	    //                         'The scan from $time ($type) found $count vulnerabilities:',
	    //                         info.vulnerabilities.length);

	    rows = info.vulnerabilities.map(
		function (vulnerability) {
		    return (
			<div className="vulnerability-row-ct-docker" title={vulnerability.description}>
			    <span>{vulnerability.title}</span>
			    <span className="pull-right">{vulnerability.severity}</span>
			</div>
		    );
	    });

	return (
	    <div>
		<div className="listing-ct-body-header">
		    { cockpit.format(text, args) }
		</div>
		<div>
		    {rows}
		</div>
	    </div>
	);

    }
}

export default ImageSecurity;
