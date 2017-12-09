import json
import h5py
from itertools import izip
import numpy as np
from datetime import datetime as dt
from os.path import isfile, join
from os import listdir


path = './data/'
def parse_hdf5(fname):
    f = h5py.File(fname)

    if not f.keys():
        return []

    geo = f['GeolocationData'] if 'GeolocationData' in f.keys() else f['GEOLOCATION_DATA']
    science = f['ScienceData'] if 'ScienceData' in f.keys() else f['SCIENCE_DATA']

    times = geo['UTC_CCSDS_A']
    lat = geo['Latitude']
    long = geo['Longitude']
    o3 = science['ColumnAmountO3']

    result = [{}]*len(times)
    for i in range(0, len(times)):
        result[i] = {'time':times[i], 'data': []}
        for la, lo, o in izip(np.array(lat[i]), np.array(long[i]), np.array(o3[i])):
            if o > 0:
                result[i]['data'].append([str(la),str(lo),str(o)])
    return result

date = dt.utcnow().strftime('%m%d')
date_long = dt.utcnow().strftime('%Y-%m-%d')
all_data = []
onlyfiles = [join(path,f) for f in listdir(path) if isfile(join(path, f)) and date in f]
for fname in onlyfiles:
    all_data += parse_hdf5(fname)

print "Creating a json with %s time entries." % len(all_data)
with open(join('./public',date_long+'.json'), 'w+') as fp:
    json.dump(all_data, fp, separators=(',',':'))
