import React, { useState } from "react";
import {
  CodeOutlined,
  FileImageOutlined,
  FileSearchOutlined,
  SignatureOutlined,
} from "@ant-design/icons";
import { Conversations } from "@ant-design/x";
import { Flex, Switch, theme } from "antd";
import { DeleteOutlined, EditOutlined, ShareAltOutlined, StopOutlined } from '@ant-design/icons';

const ConversationsApp = () => {
  const { token } = theme.useToken();
  const [deepSearchChecked, setDeepSearchChecked] = useState(false);
  // Customize the style of the container
  const style = {
    width: 256,
    background: token.colorBgContainer,
    borderRadius: token.borderRadius,
  };
  const items = [
    {
      key: "write",
      label: "Help Me Write",
      icon: <SignatureOutlined />,
    },
    {
      key: "coding",
      label: "AI Coding",
      icon: <CodeOutlined />,
    },
    {
      key: "createImage",
      label: "Create Image",
      icon: <FileImageOutlined />,
    },
    {
      key: "deepSearch",
      disabled: !deepSearchChecked,
      label: (
        <Flex gap="small" align="center">
          Deep Search
          <Switch
            size="small"
            checked={deepSearchChecked}
            onChange={setDeepSearchChecked}
          />
        </Flex>
      ),
      icon: <FileSearchOutlined />,
    },
  ];

  const menuConfig = (conversation) => ({
    items: [
      {
        label: "Rename",
        key: "Rename",
        icon: <EditOutlined />,
      },
      {
        label: "Share",
        key: "Share",
        icon: <ShareAltOutlined />,
      },
      {
        type: "divider",
      },
      {
        label: "Archive",
        key: "Archive",
        icon: <StopOutlined />,
        disabled: true,
      },
      {
        label: "Delete Chat",
        key: "deleteChat",
        icon: <DeleteOutlined />,
        danger: true,
      },
    ],
    onClick: (itemInfo) => {
      console.log(`Click ${itemInfo.key}`, conversation.key);
      itemInfo.domEvent.stopPropagation();
    },
  });
  return (
    <Conversations
      items={items}
      menu={menuConfig}
      defaultActiveKey="write"
      style={style}
    />
  );
};

export default ConversationsApp;
