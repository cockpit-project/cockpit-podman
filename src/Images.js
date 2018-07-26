import React from 'react';
import cockpit from 'cockpit';
import Listing from '../lib/cockpit-components-listing.jsx';
import ImageDetails from './ImageDetails.js';
import ContainersRunImageModal from './ContainersRunImageModal.js';
const atomic = require('./atomic');
const _ = cockpit.gettext;



import ImageSecurity from './ImageSecurity.js';



class Images extends React.Component {
    constructor(props) {
	super(props);
	// console.log(this.props.images);
	this.state = {
	    imageDetail: undefined,
	    setRunContainer: false,
	    vulnerableInfos: {}
	};
	this.vulnerableInfoChanged = this.vulnerableInfoChanged.bind(this);
	this.renderRow = this.renderRow.bind(this);
	this.navigateToImage = this.navigateToImage.bind(this);
	this.handleSearchImageClick = this.handleSearchImageClick.bind(this);
	this.showRunImageDialog = this.showRunImageDialog.bind(this);
	this.handleCancelRunImage = this.handleCancelRunImage.bind(this);

    }
    vulnerableInfoChanged(event, infos) {
	this.setState({ vulnerableInfos: infos });
    }
    componentDidMount() {
	atomic.addEventListener('vulnerableInfoChanged', this.vulnerableInfoChanged);
    }

    componentWillUnmount() {
	// $(this.props.client).off('image.containers', this.imagesChanged);
	// $(this.props.client).off('pulling.containers', this.pullingChanged);

	atomic.removeEventListener('vulnerableInfoChanged', this.vulnerableInfoChanged);
    }

    navigateToImage(image) {
	cockpit.location.go([ 'image', image.id ]);
    }

    showRunImageDialog(e) {
	// return undefined;
	// alert("where is modal");
	e.preventDefault()
	this.setState({
	    setRunContainer: true
	});

    }

    renderRow(image) {
	let vulnerabilityColumn = '';
	let vulnerableInfo = this.state.vulnerableInfos[image.Id.replace(/^sha256:/, '')];
	let count;
	let element;
	let tabs = [];

	if (vulnerableInfo) {
	    count = vulnerableInfo.vulnerabilities.length;
	    if (count > 0)
		vulnerabilityColumn = (
		    <div>
			<span className="pficon pficon-warning-triangle-o" />
			&nbsp;
			{ cockpit.format(cockpit.ngettext('1 Vulnerability', '$0 Vulnerabilities', count), count) }
		    </div>
		);
	}
	//TODO
	// if (this.props.client.waiting[image.Id]) {
	    // element = <div className="spinner" />
	// } else {
	    element = <button className="btn btn-default btn-control-ct fa fa-play"
		// onClick={undefined}
		onClick={ this.showRunImageDialog }
		data-image={image.id} />
	// }
	let columns = [
	    { name: image.RepoTags[0], header: true },
	    vulnerabilityColumn,
	    // moment.unix(image.created).calendar(),
	    image.Created.substr(0, 10),
	    cockpit.format_bytes(image.VirtualSize),
	    {
		element: element,
		tight: true
	    }
	];

	tabs.push({
	    name: _("Details"),
	    renderer: ImageDetails,
	    data: { image: image }
	});
	if (vulnerableInfo !== undefined) {
	    tabs.push({
		name: _("Security"),
		renderer: ImageSecurity,
		data: {
		    image: image,
		    info: vulnerableInfo,
		}
	    });
	}

	var actions = [
	    <button className="btn btn-danger btn-delete pficon pficon-delete"
		    // onClick={ this.deleteImage.bind(this, image) } />
		    onClick={undefined} />
	];
	return <Listing.ListingRow key={image.Id}
				   rowId={image.Id}
				   columns={columns}
				   tabRenderers={tabs}
				   navigateToItem={ this.navigateToImage(image) }
				   listingActions={actions} />;
    }

    handleSearchImageClick(event) {
	return undefined;
    }

    handleCancelRunImage() {
	this.setState(()=>({
	    setRunContainer: false
	}));
    }

    render() {
	const _ = cockpit.gettext;
	const columnTitles = [ _("Name"), _(''), _("Created"), _("Size"), _('') ];
	// let emptyCaption = _("No Images");
	let emptyCaption = _("No images that match the current filter");
	const getNewImageAction = <a role="link" tabIndex="0" onClick={this.handleSearchImageClick} className="card-pf-link-with-icon pull-right">
	    <span className="pficon pficon-add-circle-o" />{_("Get new image")}
	</a>;
	// console.log(this.state.images);
	// console.log(this.props.images);
	// let filtered = this.props.images.filter(function (image) {
	//     console.log(image.repoTags);
	//     return (image.RepoTags &&
	//             image.RepoTags[0].toLowerCase().indexOf(this.props.filterText.toLowerCase()) >= 0);
	// });
	let filtered = this.props.images;
	let imageRows = filtered.map(
	    this.renderRow);
	// console.log(filtered);
	// console.log(this.props.images);
	return(
	    <div className="container-fluid" >
		{/* <h1>This div for images table</h1> */}

		<div>
		    <Listing.Listing title={_("Images")}
			columnTitles={columnTitles}
			emptyCaption={emptyCaption}
			actions={getNewImageAction}>
			{imageRows}
		    </Listing.Listing>
		    {/* {pendingRows} */}
		</div>
		<ContainersRunImageModal
		    show={this.state.setRunContainer}
		    handleCancelRunImage={this.handleCancelRunImage}
		></ContainersRunImageModal>
	    </div>
	);
    }
}

export default Images;
