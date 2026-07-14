import { Routes, Route, useLocation } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { AuthCallback } from "./pages/AuthCallback";
import { Send } from "./pages/Send";
import { Claim } from "./pages/Claim";
import { Home } from "./pages/Home";
import { Receipts } from "./pages/Receipts";
import { NavBar } from "./components/NavBar";
import { RequireAuth } from "./components/RequireAuth";

const NAV_ROUTES = ["/home", "/send", "/receipts"];

function App() {
  const location = useLocation();
  const showNav = NAV_ROUTES.includes(location.pathname);

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/send"
          element={
            <RequireAuth>
              <Send />
            </RequireAuth>
          }
        />
        <Route path="/c/:linkId" element={<Claim />} />
        <Route
          path="/home"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />
        <Route
          path="/receipts"
          element={
            <RequireAuth>
              <Receipts />
            </RequireAuth>
          }
        />
      </Routes>
      {showNav && <NavBar />}
    </>
  );
}

export default App;
