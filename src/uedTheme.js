// V5 presentation tokens. Business defaults and model configuration stay in their original modules.
export const uedTheme = {
  token: {
    colorPrimary: '#2563eb', colorInfo: '#2563eb', colorSuccess: '#166534',
    colorWarning: '#92400e', colorError: '#b42318',
    colorBgLayout: '#f7f8fa', colorBgContainer: '#ffffff', colorBgContainerDisabled: '#ffffff',
    colorText: '#1f2937', colorTextSecondary: '#526071', colorTextTertiary: '#667085',
    colorBorder: '#dce1e8', colorBorderSecondary: '#e4e7ec',
    borderRadius: 6, controlHeight: 36, fontSize: 14,
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif',
  },
  components: {
    Layout: { siderBg: '#fff', headerBg: '#fff' },
    Menu: { itemBg: '#fff', itemColor: '#526071', itemSelectedBg: '#eff6ff', itemSelectedColor: '#1d4ed8', itemHeight: 40 },
    Card: { headerFontSize: 16, headerHeight: 48, bodyPadding: 24 },
    Table: { headerBg: '#f3f5f7', headerColor: '#526071', rowHoverBg: '#f7f8fa', cellPaddingBlock: 14, cellPaddingInline: 16 },
    Button: { primaryShadow: 'none', defaultShadow: 'none' },
    Tabs: { titleFontSize: 14, horizontalItemGutter: 28 },
    Modal: { borderRadiusLG: 12 },
  },
};
