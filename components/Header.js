import React  from 'react';
import styled from 'styled-components';

import { authActions } from '../store/auth.redux';

import { Dropdown, Layout, Menu, Spin } from 'antd';
import PropTypes                        from 'prop-types';

const { Header } = Layout;


const StyledLogoImg = styled.img`
  width: 120px;
  height: 32px;
  margin: 16px 28px 16px 0;
  float: left;
`;


export default class extends React.Component {
  static propTypes = {
    auth: PropTypes.shape({}),
  };

  logout = () => {
    const { dispatch } = this.props;
    dispatch(authActions.logout());
  };

  menu = () => (
    <Menu>
      <Menu.Item>
        <a target="_blank" rel="noopener noreferrer" href="#">Profile</a>
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item>
        <a target="_blank" rel="noopener noreferrer" onClick={this.logout}>Logout</a>
      </Menu.Item>
    </Menu>
  );

  render() {
    const { auth } = this.props;
    return (
      <Header className="header">
        <div className="logo">
          <StyledLogoImg src="/static/logo.png" alt="mast" />
        </div>
        {/*
        <Menu
          theme="dark"
          mode="horizontal"
          defaultSelectedKeys={['2']}
          style={{ lineHeight: '64px' }}
        >
          <Menu.Item key="1">Home</Menu.Item>
        </Menu>
*/}
        <div className="header-user">
          {auth.username ? (
            <div>
              Welcome,&nbsp;
              <Dropdown overlay={this.menu()}>
                <a>{auth.username}</a>
              </Dropdown>
              .
            </div>
          ) : <Spin size="small" style={{ marginLeft: 8 }} />}
        </div>
        {/* language=CSS */}
        <style jsx>{`
          .header-user {
            float: right;
            color: white;
          }
        `}</style>
      </Header>
    );
  }
}