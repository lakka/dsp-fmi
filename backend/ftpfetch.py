from ftplib import FTP
from os import listdir
from os.path import join
import ConfigParser
Config = ConfigParser.ConfigParser()
Config.read('config.ini')

def ConfigMap():
    section = 'FTP'
    dict1 = {}
    options = Config.options(section)
    for option in options:
        try:
            dict1[option] = Config.get(section, option)
            if dict1[option] == -1:
                print("skip: %s" % option)
        except:
            print("exception on %s!" % option)
            dict1[option] = None
    return dict1

config = ConfigMap()

datadir = config['savedir']
server = config['server']
user = config['user']
password = config['password']

def fetchdiff(ftp, dir):
    listing = []
    ftp.cwd(dir)
    ftp.retrlines('MLSD', listing.append)

    servfiles = [f for f in [l.split()[1] for l in listing] if 'OMPS-NPP-TC_EDR_TO3' in f and '.h5' in f]
    diff = [f for f in servfiles if f not in listdir(datadir)]

    for f in diff:
        fp = open(join(datadir, f), 'w')
        print "Fetching %s" % f
        ftp.retrbinary('RETR %s' % f, fp.write)

    ftp.cwd('/')


ftp = FTP(server, user, password)
fetchdiff(ftp, 'OMPS')
fetchdiff(ftp, 'OMPS_alaska')

ftp.quit()
