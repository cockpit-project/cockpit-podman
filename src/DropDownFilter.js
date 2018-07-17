import React from 'react';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

/**
 * For List Everything. Merge Style later
 */
class DropDownFilter extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            dropdownOpen: false,
            
        };
        this.toggle = this.toggle.bind(this);
        console.log(this.props.dropDownValue);
    }

    toggle() {
        this.setState(prevState => ({
          dropdownOpen: !prevState.dropdownOpen
        }));
    }

    render() {
        return (
            <Dropdown isOpen={this.state.dropdownOpen} toggle={this.toggle}>
              <DropdownToggle caret>
                {this.props.dropDownValue}
              </DropdownToggle>
              <DropdownMenu>
                <DropdownItem
                    onClick={this.props.handleClickEverything}
                >Everything
                </DropdownItem>
                <DropdownItem divider />
                <DropdownItem
                    onClick={this.props.handleClickRunningContainers}
                >Images and running containers
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          );
    }
}

export default DropDownFilter;