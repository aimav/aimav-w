rm ../aimav.github.io/*.js
rm ../aimav.github.io/*.css

cp ./public/img/*.* ../aimav.github.io/img
cp ./public/libs/*.* ../aimav.github.io/libs

cp ./dist/aimav-w/browser/*.* ../aimav.github.io

cd ../aimav.github.io
git add -A
git commit -a -m Deploy
git push

cd ../aimav-w
echo "Now merge dev->main on GitHub"

# EOF