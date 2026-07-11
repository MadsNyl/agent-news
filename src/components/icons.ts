"use client";

// Client boundary for reicon-react icons.
//
// reicon's icon modules call `createIcon()` (a `"use client"` export) at import
// time, so importing them directly into a Server Component executes a client
// function on the server and crashes. Re-exporting through this `"use client"`
// module puts the reicon graph on the client side of the boundary; Server
// Components then import stable client references they can render (but not call).
// Import every icon from here rather than from "reicon-react" directly.
export {
  ArrowLeft,
  ArrowRight,
  MoreH,
  Eye,
  Share,
  Play,
  X,
  Check,
  CheckCircle,
  InfoCircle,
  AlertCircle,
  XCircle,
  Loader,
  Search,
  Trash,
  File,
  Video,
  Inbox,
  Plus,
  Login,
  Logout,
} from "reicon-react";
