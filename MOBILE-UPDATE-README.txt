RVP Control — full mobile update

Replace these files in your current GitHub project:
1) src/App.tsx
2) src/index.css
3) src/components/MobileNav.tsx

Also replace all files inside src/pages from this package that exist in your project.
This update does NOT touch Supabase configuration, Telegram integration, database logic, or GitHub Actions.

Then:
GitHub Desktop -> Summary: Full mobile responsive update
Commit to main -> Push origin
GitHub Actions will redeploy automatically.
