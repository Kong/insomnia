import React, { PropTypes, Component } from 'react'

class Header extends Component {
    render () {
        return (
            <header>
                <h1>Hello World! <i className="fa fa-wrench"></i></h1>
            </header>
        )
    }
}

Header.propTypes = {};

export default Header
