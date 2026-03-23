cd ~/dev/solar-eclipse
git pull
echo "Pulled latest changes"
mkdir -p /var/www/motleytech/html/apps
rm -rf /var/www/motleytech/html/apps/solar-eclipses
cp -r dist /var/www/motleytech/html/apps/solar-eclipses
echo "Copied dist to /var/www/motleytech/html/apps/solar-eclipses"
echo "Done"

