import React from 'react';

//TODO
const handleClick = (event) => {
    if (event.button !== 0)
        return;
    var action = this.props.actions[event.currentTarget.getAttribute('data-value')];
    if (!action.disabled && action.onActivate)
        action.onActivate();
};

const DropDown = (props) => {
    return (
        <div className="btn-group">
            <button className="btn btn-default" type="button" data-value="0" onClick={handleClick}>
                <span>{props.actions[0].label}</span>
            </button>
            <button className="btn btn-default dropdown-toggle" data-toggle="dropdown">
                <div className="caret" />
            </button>
            <ul className="dropdown-menu dropdown-menu-right" role="menu">
                {
                    props.actions.map((action, index) => {
                        return (
                            <li key={index} className={ action.disabled ? 'disabled' : '' }>
                                <a data-value={index} role="link" tabIndex="0" onClick={handleClick}>{action.label}</a>
                            </li>
                        );
                    })
                }
            </ul>
        </div>
    );
};

DropDown.defaultProps = {
    actions: [ { label: '' } ]
};

export default DropDown;