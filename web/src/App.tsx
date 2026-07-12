import { Routes, Route } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { AuthCallback } from "./pages/AuthCallback";
import { Send } from "./pages/Send";
import { Claim } from "./pages/Claim";
import { Home } from "./pages/Home";
import { Receipts } from "./pages/Receipts";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/send" element={<Send />} />
      <Route path="/c/:linkId" element={<Claim />} />
      <Route path="/home" element={<Home />} />
      <Route path="/receipts" element={<Receipts />} />
    </Routes>
  );
}

export default App;
