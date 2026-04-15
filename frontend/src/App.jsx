import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Webhooks from "./pages/Webhooks.jsx";
import Strategies from "./pages/Strategies.jsx";
import Holdings from "./pages/Holdings.jsx";
import Orders from "./pages/Orders.jsx";
import Logs from "./pages/Logs.jsx";
import SettingsPage from "./pages/Settings.jsx";
import Portfolio from "./pages/Portfolio.jsx";
import Watchlist from "./pages/Watchlist.jsx";
import { getToken } from "./api.js";

function PrivateLayout() {
  if (!getToken()) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<PrivateLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/webhooks" element={<Webhooks />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="/holdings" element={<Holdings />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route
        path="*"
        element={<Navigate to={getToken() ? "/dashboard" : "/login"} replace />}
      />
    </Routes>
  );
}
