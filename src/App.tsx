import { Suspense, lazy } from "react";
import {
  App as AntApp,
  Button,
  ConfigProvider,
  Menu,
  Result,
  Spin,
} from "antd";
import zhCN from "antd/locale/zh_CN";
import { CalculatorOutlined, DownOutlined } from "@ant-design/icons";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
  useNavigate,
  useRouteError,
} from "react-router-dom";
import { errorMessage } from "./api/client";

const ProjectList = lazy(() =>
  import("./features/calculations/ProjectList").then((module) => ({
    default: module.ProjectList,
  })),
);
const CalculationPage = lazy(() =>
  import("./features/calculations/CalculationPage").then((module) => ({
    default: module.CalculationPage,
  })),
);

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="app-shell">
      <header className="top-navigation">
        <div className="brand">
          <span className="brand-logo">
            <img
              src={`${import.meta.env.BASE_URL}assets/logo-mark.svg`}
              alt=""
              width="14"
              height="14"
            />
          </span>
          <span>环保管理平台</span>
        </div>
        <span className="top-module">源强计算工具</span>
      </header>
      <aside className="sidebar">
        <div className="sidebar-group">
          <CalculatorOutlined />
          <span>源强计算工具</span>
          <DownOutlined className="chevron" />
        </div>
        <Menu
          selectedKeys={["calculations"]}
          items={[
            {
              key: "calculations",
              label: "二污普系数计算",
              icon: <span className="menu-dot" />,
            },
          ]}
          onClick={() => navigate("/calculations")}
        />
      </aside>
      <main className="main-content">
        <Suspense
          fallback={
            <div className="page-loading">
              <Spin />
            </div>
          }
        >
          <Outlet key={`${location.pathname}${location.search}`} />
        </Suspense>
      </main>
    </div>
  );
}

function RouteError() {
  const error = useRouteError();
  return (
    <Result
      status="error"
      title="页面加载失败"
      subTitle={errorMessage(error)}
      extra={
        <Button
          onClick={() =>
            window.location.assign(`${import.meta.env.BASE_URL}calculations`)
          }
        >
          返回计算记录
        </Button>
      }
    />
  );
}

// basename 与 Vite 的资源前缀一致，使子页面刷新和站内导航都停留在本站点内。
const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      errorElement: <RouteError />,
      children: [
        { index: true, element: <Navigate to="/calculations" replace /> },
        { path: "calculations", element: <ProjectList /> },
        { path: "calculations/new", element: <CalculationPage /> },
        { path: "calculations/:id/edit", element: <CalculationPage /> },
        { path: "calculations/:id", element: <CalculationPage readOnly /> },
        {
          path: "*",
          element: (
            <Result
              status="404"
              title="页面不存在"
              extra={
                <a href={`${import.meta.env.BASE_URL}calculations`}>
                  返回计算记录
                </a>
              }
            />
          ),
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#1677ff",
          colorBgLayout: "#f5f5f5",
          colorText: "#262626",
          colorTextSecondary: "#8c8c8c",
          borderRadius: 5,
          fontSize: 13,
          controlHeight: 36,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        },
        components: {
          Table: {
            headerBg: "#f7f9fc",
            headerColor: "#595959",
            cellPaddingBlock: 14,
          },
          Menu: {
            itemBorderRadius: 0,
            itemMarginInline: 0,
            itemMarginBlock: 0,
            itemSelectedBg: "#e6f4ff",
            itemHeight: 40,
          },
        },
      }}
    >
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </ConfigProvider>
  );
}
