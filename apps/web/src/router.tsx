import { createBrowserRouter, Navigate } from 'react-router';
import { BookmarksPage } from '@/pages/bookmarks-page';

export const router = createBrowserRouter([
  { index: true, element: <BookmarksPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
