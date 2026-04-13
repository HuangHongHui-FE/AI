import React from "react";

import { AntDesignOutlined, RedoOutlined, UserOutlined  } from "@ant-design/icons";
import { Actions, Bubble } from "@ant-design/x";
import { Avatar } from "antd";
const actionItems = (content) => [
  {
    key: "copy",
    label: "copy",
    actionRender: () => {
      return <Actions.Copy text={content} />;
    },
  },
  {
    key: "retry",
    icon: <RedoOutlined />,
    label: "Retry",
  },
];
const text = `Hello World\nNext line\nTab\tindent`;
const BubbleCom = () => (
  <>
    <Bubble
      content={text}
      typing={{ effect: "fade-in" }}
      header={<h5>Ant Design X</h5>}
      footer={(content) => (
        <Actions
          items={actionItems(content)}
          onClick={() => console.log(content)}
        />
      )}
      placement="end"
      avatar={<Avatar icon={<AntDesignOutlined />} />}
    />

    <Bubble.System variant="outlined" shape="round" content={<>{text} ok</>} />

    <Bubble.Divider content="Plain Text" dividerProps={{ plain: true }} />

    <Bubble loading={true} content="hello world !" />

    <Bubble
      loading={false}
      content={'Ant Design X - Better UI toolkit for your AI Chat WebApp.'}
      typing={{
        effect: "fade-in",
        interval: 50,
        step: 3,
      }}
      header={<h5>ADX</h5>}
      footer={(content) => (
        <Actions items={actionItems(content)} onClick={() => console.log(content)} />
      )}
      avatar={<Avatar icon={<UserOutlined />} />}
      onTyping={() => console.log("typing")}
      onTypingComplete={() => console.log("typing complete")}
    />
  </>
);
export default BubbleCom;
