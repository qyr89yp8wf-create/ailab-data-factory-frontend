import React, {createContext, useContext, useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Button} from 'antd';
import {ArrowLeftOutlined} from '@ant-design/icons';

const Workspace = createContext(null);

export function DetailWorkspace({children}) {
  const [pages, setPages] = useState([]);
  useEffect(() => {
    const content = document.querySelector('.app-content');
    if (!pages.length) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (content) content.inert = true;
    return () => {
      document.body.style.overflow = overflow;
      if (content) content.inert = false;
    };
  }, [pages.length]);
  return <Workspace.Provider value={{pages, setPages}}>{children}</Workspace.Provider>;
}

// Full-width detail navigation. Underlying views keep their filters and scroll position.
// Only the current page is exposed; a rule sample may still use the one remaining drawer.
export default function DetailPage({open, title, onClose, children}) {
  const id = useId();
  const context = useContext(Workspace);
  const button = useRef(null);
  const origin = useRef(null);
  const top = !context || context.pages.at(-1) === id;
  const setPages = context?.setPages;
  useEffect(() => {
    if (!open) return;
    origin.current = document.activeElement;
    setPages?.(items => [...items.filter(item => item !== id), id]);
    return () => {
      setPages?.(items => items.filter(item => item !== id));
      requestAnimationFrame(() => {
        if (origin.current?.isConnected) origin.current.focus?.();
      });
    };
  }, [open, id, setPages]);
  useEffect(() => { if (open && top) button.current?.focus(); }, [open, top]);
  if (!open) return null;
  return createPortal(<section className="ued-detail-page" hidden={!top} aria-label={typeof title === 'string' ? title : '来源任务详情'}>
    <header className="ued-detail-heading">
      <Button ref={button} type="text" icon={<ArrowLeftOutlined/>} onClick={onClose}>返回</Button>
      <div className="ued-detail-heading-title">{title}</div>
    </header>
    <div className="ued-detail-body">{children}</div>
  </section>, document.body);
}
