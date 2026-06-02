# Make dist dir
npm run build

# Remove old version
rm ../aimav.github.io/*.js
rm ../aimav.github.io/*.css

# Image, lib, simple apps
cp ./public/img/*.* ../aimav.github.io/img
cp ./public/libs/*.* ../aimav.github.io/libs
cp ./public/apps/calculator/*.* ../aimav.github.io/apps/calculator

# Main Aimav W
cp ./dist/aimav-w/browser/*.* ../aimav.github.io

# Logseq LF app
# cp -r  ./apps/logseq-lf/*  ../aimav.github.io/apps/logseq-lf

# Go to deployment site and commit
cd ../aimav.github.io
git add -A
git commit -a -m Deploy
git push

cd ../aimav-w
echo "----------------------------------------------------"
echo "Now merge dev->main on GitHub of aimav.github.io"
echo "----------------------------------------------------"

# EOF