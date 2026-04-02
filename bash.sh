sshpass -vvv -p '!}k"mw@:QprQ;6gG-_' sftp -P 22 avante01@ps-sftp.partssource.com <<< "put /home/matt-teixeira/hep3/part-source-pipeline/files/test.csv ./test.csv"
scp avante-debian:/home/matt-teixeira/hep3/part-source-pipeline/files/Avante_Imaging_Inventory.csv .
scp avante-debian:/home/matt-teixeira/hep3/part-source-pipeline/files/Avante_Biomed_Inventory.csv .

sudo cp Avante_Biomed_Inventory.csv /opt/
sudo cp Avante_Imaging_Inventory.csv /opt/