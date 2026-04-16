import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Holdings from "./pages/Holdings.jsx";
import SettingsPage from "./pages/Settings.jsx";
import Watchlist from "./pages/Watchlist.jsx";
import MarketBrief from "./pages/Market.jsx";
import Intel from "./pages/Intel.jsx";
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
        <Route path="/" element={<Navigate to="/intel" replace />} />
        <Route path="/intel" element={<Intel />} />
        <Route path="/market" element={<MarketBrief />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/holdings" element={<Holdings />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route
        path="*"
        element={<Navigate to={getToken() ? "/dashboard" : "/login"} replace />}
      />
    </Routes>
  );
}
